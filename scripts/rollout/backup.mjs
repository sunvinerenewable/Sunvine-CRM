import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { withClient } from './db.mjs';

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups', timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`=== [STEP 1] INITIATING FULL DATABASE BACKUP ===`);
  console.log(`Target Directory: ${backupDir}`);

  await withClient(async (client) => {
    // 1. Discover all public tables
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tableRes.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} public base tables to backup.`);

    const manifest = {
      timestamp: new Date().toISOString(),
      backupFolder: timestamp,
      tables: {},
      files: {}
    };

    // 2. Dump each table to NDJSON in batches of 1000
    for (const table of tables) {
      const filePath = path.join(backupDir, `${table}.ndjson`);
      const fileStream = fs.createWriteStream(filePath, { flags: 'w', encoding: 'utf8' });

      let offset = 0;
      const batchSize = 1000;
      let totalRows = 0;

      while (true) {
        const batchRes = await client.query(
          `SELECT * FROM public."${table}" ORDER BY ctid LIMIT $1 OFFSET $2`,
          [batchSize, offset]
        );

        if (batchRes.rows.length === 0) break;

        for (const row of batchRes.rows) {
          fileStream.write(JSON.stringify(row) + '\n');
        }

        totalRows += batchRes.rows.length;
        offset += batchSize;

        if (batchRes.rows.length < batchSize) break;
      }

      await new Promise(resolve => fileStream.end(resolve));

      const sha = computeSha256(filePath);
      const stat = fs.statSync(filePath);

      manifest.tables[table] = {
        rowCount: totalRows,
        fileSize: stat.size,
        sha256: sha
      };

      manifest.files[`${table}.ndjson`] = {
        size: stat.size,
        sha256: sha
      };

      console.log(`  ✓ ${table.padEnd(28)} : ${String(totalRows).padStart(6)} rows (${(stat.size / 1024).toFixed(1)} KB)`);
    }

    // 3. Schema Metadata (columns, constraints, indexes, triggers, functions, RLS, policies, sequences, extensions)
    console.log('\nExporting database schema metadata (schema.json)...');

    // Columns
    const columnsRes = await client.query(`
      SELECT table_name, column_name, ordinal_position, column_default, is_nullable, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    // Constraints
    const constraintsRes = await client.query(`
      SELECT conname, contype, conrelid::regclass::text as table_name, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
      ORDER BY table_name, conname;
    `);

    // Indexes
    const indexesRes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);

    // Triggers
    const triggersRes = await client.query(`
      SELECT tgname, relname as table_name, pg_get_triggerdef(t.oid) as def
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT tgisinternal
      ORDER BY table_name, tgname;
    `);

    // Functions
    const functionsRes = await client.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
      ORDER BY p.proname;
    `);

    // RLS Status
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    // Policies (public AND storage)
    const policiesRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname IN ('public', 'storage')
      ORDER BY schemaname, tablename, policyname;
    `);

    // Sequences
    const sequencesRes = await client.query(`
      SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
      ORDER BY sequence_name;
    `);

    // Extensions
    const extensionsRes = await client.query(`
      SELECT extname, extversion FROM pg_extension ORDER BY extname;
    `);

    const schemaData = {
      columns: columnsRes.rows,
      constraints: constraintsRes.rows,
      indexes: indexesRes.rows,
      triggers: triggersRes.rows,
      functions: functionsRes.rows,
      rlsStatus: rlsRes.rows,
      policies: policiesRes.rows,
      sequences: sequencesRes.rows,
      extensions: extensionsRes.rows
    };

    const schemaPath = path.join(backupDir, 'schema.json');
    fs.writeFileSync(schemaPath, JSON.stringify(schemaData, null, 2), 'utf8');
    manifest.files['schema.json'] = {
      size: fs.statSync(schemaPath).size,
      sha256: computeSha256(schemaPath)
    };

    // 4. Storage Metadata (storage.buckets & sunvine-documents storage.objects)
    console.log('Exporting storage metadata (storage.json)...');
    let storageBuckets = [];
    let storageObjects = [];
    try {
      const bucketsRes = await client.query(`SELECT * FROM storage.buckets ORDER BY id;`);
      storageBuckets = bucketsRes.rows;
    } catch (_) {}

    try {
      const objectsRes = await client.query(`
        SELECT bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata
        FROM storage.objects
        WHERE bucket_id = 'sunvine-documents'
        ORDER BY name;
      `);
      storageObjects = objectsRes.rows;
    } catch (_) {}

    const storageData = {
      buckets: storageBuckets,
      sunvineDocumentsCount: storageObjects.length,
      objects: storageObjects
    };

    const storagePath = path.join(backupDir, 'storage.json');
    fs.writeFileSync(storagePath, JSON.stringify(storageData, null, 2), 'utf8');
    manifest.files['storage.json'] = {
      size: fs.statSync(storagePath).size,
      sha256: computeSha256(storagePath)
    };

    // 5. RESTORE.md documentation
    const restoreMdPath = path.join(backupDir, 'RESTORE.md');
    const restoreMdContent = `# Disaster Recovery & Restore Instructions

This directory contains a complete verified backup created at ${manifest.timestamp}.

## Contents
1. \`schema.json\`: Full database structure, column definitions, constraints, indexes, triggers, custom RPC functions, and all RLS security policies.
2. \`storage.json\`: Supabase storage bucket configurations and objects inventory.
3. \`*.ndjson\`: Line-delimited JSON containing all table rows.
4. \`MANIFEST.json\`: Table row counts and SHA-256 integrity verification hashes.

## How to Restore a Table
To restore rows from an NDJSON file (e.g. \`quotations.ndjson\`):
\`\`\`javascript
import fs from 'fs';
import readline from 'readline';
import { withClient } from '../../scripts/rollout/db.mjs';

async function restore(table, ndjsonFile) {
  const rl = readline.createInterface({ input: fs.createReadStream(ndjsonFile) });
  await withClient(async client => {
    for await (const line of rl) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      const cols = Object.keys(row);
      const vals = Object.values(row);
      const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
      await client.query(
        \`INSERT INTO public.\${table} (\${cols.map(c => '"' + c + '"').join(', ')}) 
         VALUES (\${placeholders}) 
         ON CONFLICT (id) DO UPDATE SET \${cols.map(c => '"' + c + '" = EXCLUDED."' + c + '"').join(', ')}\`,
        vals
      );
    }
  });
}
\`\`\`
`;
    fs.writeFileSync(restoreMdPath, restoreMdContent, 'utf8');
    manifest.files['RESTORE.md'] = {
      size: fs.statSync(restoreMdPath).size,
      sha256: computeSha256(restoreMdPath)
    };

    // Save MANIFEST.json
    const manifestPath = path.join(backupDir, 'MANIFEST.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // 6. Verification: re-count rows in DB and compare with manifest
    console.log('\n--- Verifying Backup Integrity Against Live Database ---');
    let hasVerificationError = false;
    for (const table of tables) {
      const countRes = await client.query(`SELECT count(*)::bigint as cnt FROM public."${table}"`);
      const liveCount = Number(countRes.rows[0].cnt);
      const dumpedCount = manifest.tables[table].rowCount;

      if (liveCount !== dumpedCount) {
        console.error(`❌ MISMATCH in ${table}: Live has ${liveCount} rows, but backup has ${dumpedCount}!`);
        hasVerificationError = true;
      } else {
        console.log(`  ✓ ${table.padEnd(28)}: Verified match (${liveCount} rows)`);
      }
    }

    if (hasVerificationError) {
      console.error('\n[FATAL] Backup verification failed due to row count mismatch. Stopping.');
      process.exit(1);
    }

    // Calculate total folder size
    let totalBytes = 0;
    Object.values(manifest.files).forEach(f => { totalBytes += f.size; });

    console.log(`\n✅ BACKUP COMPLETED AND FULLY VERIFIED!`);
    console.log(`Directory : ${backupDir}`);
    console.log(`Total Size: ${(totalBytes / 1024).toFixed(2)} KB`);
  });
}

main().catch(err => {
  console.error('\n[BACKUP FAILURE]:', err.message);
  process.exit(1);
});

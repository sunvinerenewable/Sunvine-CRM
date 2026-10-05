import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

let env = {};
try {
  const content = fs.readFileSync('.env', 'utf8');
  for (const line of content.split('\n')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
} catch (e) {}

const client = new Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  console.log('=== TABLE SCHEMA: audit_logs ===');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'audit_logs' 
    ORDER BY ordinal_position;
  `);
  console.table(cols.rows);

  console.log('\n=== RLS POLICIES: audit_logs ===');
  const pols = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'audit_logs';
  `);
  console.table(pols.rows);

  console.log('\n=== RLS ENABLED? ===');
  const rls = await client.query(`
    SELECT relname, relrowsecurity, relforcerowsecurity 
    FROM pg_class 
    WHERE relname = 'audit_logs';
  `);
  console.table(rls.rows);

  // Also check if audit_log (singular) exists
  const singularCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'audit_log' 
    ORDER BY ordinal_position;
  `);
  console.log('\n=== ALL AUDIT TABLES / VIEWS ===');
  const allAudit = await client.query(`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_name LIKE 'audit_%' AND table_schema = 'public';
  `);
  console.table(allAudit.rows);

  await client.end();
}

main().catch(err => console.error(err));

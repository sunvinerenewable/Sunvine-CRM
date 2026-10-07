import fs from 'fs';
import path from 'path';
import { getClient } from './db.mjs';

/**
 * Scan SQL content for prohibited destructive operations.
 */
function scanDestructiveKeywords(sql) {
  const lines = sql.split(/\r?\n/);
  const dangerousPatterns = [
    /(?<!ALTER\s+PUBLICATION\s+[\s\S]*)\bDROP\s+TABLE\s+(?!IF\s+EXISTS\s+public\.\%I)/i,
    /\bDROP\s+SCHEMA\b/i,
    /\bTRUNCATE\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bALTER\s+TABLE\b.*\bDROP\s+COLUMN\b/i
  ];

  const violations = [];
  lines.forEach((line, idx) => {
    // Skip full-line SQL comments
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed.startsWith('/*')) return;
    if (/ALTER\s+PUBLICATION\s+.*DROP\s+TABLE/i.test(trimmed)) return;

    for (const pattern of dangerousPatterns) {
      if (pattern.test(line)) {
        violations.push({ lineNum: idx + 1, content: line.trim() });
        break;
      }
    }
  });

  return violations;
}

/**
 * Parse SQL into executable statements while stripping top-level BEGIN/COMMIT
 * so our transactional wrapper controls the commit or rollback.
 */
function prepareSqlStatements(sql) {
  // Remove standalone BEGIN/COMMIT so we control the transaction
  let cleaned = sql
    .replace(/^\s*BEGIN\s*;/gim, '-- BEGIN (managed by runner)')
    .replace(/^\s*COMMIT\s*;/gim, '-- COMMIT (managed by runner)');

  return cleaned;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const filePath = args.find(a => !a.startsWith('--'));

  if (!filePath) {
    console.error('Usage: node scripts/rollout/runSql.mjs <file.sql> [--dry-run]');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`[ERROR] File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(resolvedPath, 'utf8');

  console.log(`\n=== SQL EXECUTION: ${path.basename(resolvedPath)} ===`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (WILL BE ROLLED BACK)' : 'PRODUCTION EXECUTION (SINGLE TRANSACTION)'}`);

  // Safety pre-flight check
  const violations = scanDestructiveKeywords(sqlContent);
  if (violations.length > 0) {
    console.error('\n[SAFETY VIOLATION DETECTED] Script contains potentially destructive commands:');
    violations.forEach(v => console.error(`  Line ${v.lineNum}: ${v.content}`));
    console.error('\nStopping execution immediately per safety directives. Awaiting manual review.');
    process.exit(2);
  }

  const client = await getClient();
  try {
    console.log('Initiating transaction...');
    await client.query('BEGIN');

    const executableSql = prepareSqlStatements(sqlContent);
    await client.query(executableSql);

    if (isDryRun) {
      await client.query('ROLLBACK');
      console.log('✅ DRY-RUN COMPLETED SUCCESSFULLY: All statements executed without syntax/constraint errors and ROLLED BACK.');
    } else {
      await client.query('COMMIT');
      console.log('✅ PRODUCTION COMMIT SUCCESSFUL: All statements committed.');
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('\n❌ SQL EXECUTION ERROR (Transaction Rolled Back):', err.message);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}

main().catch(err => {
  console.error('Execution failure:', err.message);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';
import { getEnvConfig, withClient } from './db.mjs';

async function main() {
  console.log('=== [STEP 0] PREFLIGHT ENVIRONMENT & DATABASE CHECK ===');

  const config = getEnvConfig();

  const required = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'TEST_ADMIN_EMAIL',
    'TEST_ADMIN_PASSWORD'
  ];

  console.log('\n--- Environment Variables Status ---');
  let hasMissing = false;
  for (const key of required) {
    const isPresent = Boolean(config[key] && String(config[key]).trim().length > 0);
    console.log(`${key.padEnd(26)}: ${isPresent ? 'PRESENT' : 'MISSING'}`);
    if (!isPresent) hasMissing = true;
  }

  // Report missing status but attempt database connection if DATABASE_URL is available
  if (!config.DATABASE_URL) {
    console.error('\n[ERROR] DATABASE_URL is missing. Cannot connect to database.');
    process.exit(1);
  }


  // Verify project ref in connection details if configured
  const dbUrl = config.DATABASE_URL || '';
  const expectedRef = process.env.SUPABASE_PROJECT_ID;
  if (expectedRef && !dbUrl.includes(expectedRef)) {
    console.error(`\n[ERROR] Database URL does not match target project ref (${expectedRef}).`);
    process.exit(1);
  }

  console.log('\nConnecting to Supabase PostgreSQL (production)...');
  try {
    await withClient(async (client) => {
      // 1. Database name and server version
      const basicRes = await client.query('SELECT current_database(), current_user, version()');
      const row = basicRes.rows[0];
      console.log(`Connected successfully! Database: ${row.current_database}`);
      console.log(`Server Version: ${row.version.split(',')[0]}`);

      // 2. Public tables and row counts
      const tableQuery = `
        SELECT 
          c.relname AS table_name,
          c.reltuples::bigint AS estimated_rows,
          COALESCE(s.n_live_tup, 0) AS live_rows
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE n.nspname = 'public' 
          AND c.relkind = 'r'
        ORDER BY c.relname;
      `;
      const tableRes = await client.query(tableQuery);

      console.log('\n--- Public Tables and Estimated Row Counts ---');
      let baselineText = `Sunvine Production Database Baseline\n`;
      baselineText += `Project Ref: wyberzvcyrjipjqpotwe\n`;
      baselineText += `Database: ${row.current_database}\n`;
      baselineText += `Version: ${row.version}\n`;
      baselineText += `Timestamp: ${new Date().toISOString()}\n\n`;
      baselineText += `Public Tables:\n`;
      baselineText += `--------------------------------------------------------\n`;
      baselineText += `${'Table Name'.padEnd(32)} | Live Rows (est.)\n`;
      baselineText += `--------------------------------------------------------\n`;

      for (const t of tableRes.rows) {
        const line = `${t.table_name.padEnd(32)} | ${t.live_rows}`;
        console.log(line);
        baselineText += `${line}\n`;
      }
      baselineText += `--------------------------------------------------------\n`;
      baselineText += `Total tables: ${tableRes.rows.length}\n`;

      // Save to rollout-run/00-baseline.txt
      const outDir = path.resolve(process.cwd(), 'rollout-run');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const baselinePath = path.join(outDir, '00-baseline.txt');
      fs.writeFileSync(baselinePath, baselineText, 'utf8');

      console.log(`\nBaseline successfully recorded to: ${baselinePath}`);
    });
  } catch (err) {
    console.error('\n[DATABASE CONNECTION ERROR]:', err.message);
    if (err.message.includes('password authentication failed')) {
      console.error('Diagnostic: Database password was rejected. Check password or pooler configuration.');
    } else if (err.message.includes('Tenant or user not found')) {
      console.error('Diagnostic: Pooler username format must be postgres.<project_ref>.');
    } else if (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
      console.error('Diagnostic: Network DNS resolution or connection timeout to Supabase pooler.');
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});

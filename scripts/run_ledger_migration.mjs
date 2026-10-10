import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;

async function executeMigration(envFile, label) {
  console.log(`\n======================================================`);
  console.log(`Running 005_dealer_financial_ledger.sql on ${label}`);
  console.log(`======================================================`);

  if (!fs.existsSync(envFile)) {
    console.error(`❌ Env file not found: ${envFile}`);
    return false;
  }

  const content = fs.readFileSync(envFile, 'utf8');
  const match = content.match(/^\s*DATABASE_URL\s*=\s*([^\r\n]+)/m);
  if (!match) {
    console.error(`❌ DATABASE_URL not found in ${envFile}`);
    return false;
  }

  const dbUrl = match[1].trim().replace(/^['"]|['"]$/g, '');
  const migrationPath = path.resolve('supabase/migrations/005_dealer_financial_ledger.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log(`Connecting to ${label}...`);
    await client.connect();
    console.log(`Connected successfully.`);

    console.log(`Applying migration in transaction...`);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✅ Migration committed successfully on ${label}!`);

    // Verify dealer_accounts columns
    const colsRes = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'dealer_accounts'
        AND column_name IN ('dealer_type', 'default_commission_per_kw', 'registration_fee_rate', 'distance_from_rajkot_km')
      ORDER BY column_name;
    `);
    console.log(`\nVerification: Added columns in public.dealer_accounts:`);
    console.table(colsRes.rows);

    // Verify dealer_ledger_entries table
    const tableRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'dealer_ledger_entries'
      ORDER BY ordinal_position;
    `);
    console.log(`Verification: Table public.dealer_ledger_entries columns (${tableRes.rows.length} columns):`);
    console.table(tableRes.rows);

    // Verify row level security and policies
    const policyRes = await client.query(`
      SELECT policyname, cmd
      FROM pg_policies
      WHERE tablename = 'dealer_ledger_entries';
    `);
    console.log(`Verification: Policies on dealer_ledger_entries:`);
    console.table(policyRes.rows);

    await client.end();
    return true;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    try { await client.end(); } catch (_) {}
    console.error(`❌ Error on ${label}:`, err.message);
    return false;
  }
}

async function main() {
  const target = process.argv[2] || 'staging';
  if (target === 'staging') {
    await executeMigration('.env.staging', '🟡 STAGING (voyargkmlkrlidyxjcbk)');
  } else if (target === 'prod' || target === 'production') {
    await executeMigration('.env.production', '🟢 PRODUCTION (wyberzvcyrjipjqpotwe)');
  } else if (target === 'all') {
    console.log('Running on both STAGING and PRODUCTION...');
    await executeMigration('.env.staging', '🟡 STAGING (voyargkmlkrlidyxjcbk)');
    await executeMigration('.env.production', '🟢 PRODUCTION (wyberzvcyrjipjqpotwe)');
  }
}

main();

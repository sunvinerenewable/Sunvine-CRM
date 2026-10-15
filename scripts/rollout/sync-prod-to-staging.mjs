import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

// Dependency-ordered tables for public schema
const TABLES_IN_ORDER = [
  'system_settings',
  'pricing_presets',
  'dealer_custom_pricing',
  'solar_banks',
  'solar_modules',
  'solar_inverters',
  'inverter_benchmark_matrix',
  'bom_catalog',
  'bom_catalog_items',
  'bos_pricing_matrix',
  'solar_kits_presets',
  'document_master',
  'admin_accounts',
  'staff_accounts',
  'dealer_accounts',
  'dealer_product_overrides',
  'customer_files',
  'quotations',
  'quotation_bom_snapshots',
  'notifications',
  'push_subscriptions',
  'otp_verifications',
  'audit_logs'
];

async function syncDatabases() {
  const prodDbUrl = process.env.PROD_DATABASE_URL;
  const stagingDbUrl = process.env.DATABASE_URL;

  if (!prodDbUrl) {
    console.error('================================================================');
    console.error('ERROR: PROD_DATABASE_URL is required to copy data.');
    console.error('Please run with PROD_DATABASE_URL=<prod_conn_string>');
    console.error('Example:');
    console.error('  $env:PROD_DATABASE_URL="postgresql://postgres.wyberzvcyrjipjqpotwe:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"');
    console.error('  node scripts/rollout/sync-prod-to-staging.mjs');
    console.error('================================================================');
    process.exit(1);
  }

  console.log('Connecting to Production (Source)...');
  const prodClient = new Client({
    connectionString: prodDbUrl,
    ssl: { rejectUnauthorized: false }
  });
  await prodClient.connect();
  console.log('Connected to Production Database.');

  console.log('Connecting to Staging (Destination)...');
  const stagingClient = new Client({
    connectionString: stagingDbUrl,
    ssl: { rejectUnauthorized: false }
  });
  await stagingClient.connect();
  console.log('Connected to Staging Database.');

  console.log('\n--- Starting Full Database Copy (Production -> Staging) ---');

  for (const table of TABLES_IN_ORDER) {
    try {
      // Check if table exists in prod
      const checkProd = await prodClient.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);

      if (checkProd.rows.length === 0) {
        console.log(`[SKIP] Table ${table} does not exist in Production.`);
        continue;
      }

      // Fetch all rows from Prod
      const prodData = await prodClient.query(`SELECT * FROM public."${table}"`);
      const rows = prodData.rows;
      console.log(`\nTable [${table}]: Found ${rows.length} rows in Production.`);

      if (rows.length === 0) {
        console.log(`  -> 0 rows to copy.`);
        continue;
      }

      // Disable constraints / Truncate & insert
      await stagingClient.query('BEGIN');
      await stagingClient.query(`TRUNCATE TABLE public."${table}" CASCADE`);

      const columns = Object.keys(rows[0]);
      const colNames = columns.map(c => `"${c}"`).join(', ');
      
      for (const row of rows) {
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(c => row[c]);
        await stagingClient.query(
          `INSERT INTO public."${table}" (${colNames}) VALUES (${placeholders})`,
          values
        );
      }

      await stagingClient.query('COMMIT');
      console.log(`  ✅ Successfully copied ${rows.length} rows to Staging.`);
    } catch (err) {
      await stagingClient.query('ROLLBACK');
      console.error(`  ❌ Failed copying table ${table}:`, err.message);
    }
  }

  await prodClient.end();
  await stagingClient.end();

  console.log('\n🎉 FULL DATABASE SYNC COMPLETED SUCCESSFULLY!');
}

syncDatabases().catch(err => {
  console.error('Sync error:', err.message);
  process.exit(1);
});

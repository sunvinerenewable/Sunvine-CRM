import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;

// Safely parse .env file
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('[ERROR] DATABASE_URL is not defined in .env or environment.');
  process.exit(1);
}

const targetFile = process.argv[2] || 'supabase/migrations/003_staff_and_dealer_sync.sql';
const resolvedPath = path.resolve(process.cwd(), targetFile);

if (!fs.existsSync(resolvedPath)) {
  console.error(`[ERROR] SQL file not found: ${resolvedPath}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(resolvedPath, 'utf8');

async function run() {
  console.log(`\n======================================================`);
  console.log(`Executing SQL Migration: ${path.basename(resolvedPath)}`);
  console.log(`======================================================\n`);

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully.\n');

    console.log('Executing migration statements in transaction...');
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');

    console.log('✅ Migration executed and committed successfully!\n');

    // Verification check
    const staffCount = await client.query('SELECT COUNT(*) FROM public.staff_accounts;');
    const staffRows = await client.query('SELECT id, name, role, department, phone, mobile_number, status FROM public.staff_accounts ORDER BY id ASC LIMIT 10;');
    
    console.log(`Current staff_accounts count: ${staffCount.rows[0].count}`);
    console.table(staffRows.rows);

    const dealerCount = await client.query('SELECT COUNT(*) FROM public.dealer_accounts;');
    console.log(`Current dealer_accounts count: ${dealerCount.rows[0].count}`);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

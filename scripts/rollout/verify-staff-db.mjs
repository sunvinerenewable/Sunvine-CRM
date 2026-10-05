import pkg from 'pg';
import fs from 'fs';
import path from 'path';
const { Client } = pkg;

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

async function check() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const staff = await client.query('SELECT id, name, role, department, mobile_number, status, created_at FROM public.staff_accounts ORDER BY created_at DESC;');
  console.log('\n--- LIVE STAFF ACCOUNTS IN POSTGRESQL ---');
  console.table(staff.rows);

  const dealers = await client.query('SELECT dealer_code, firm_name, assigned_staff_id, assigned_staff_name, updated_at FROM public.dealer_accounts ORDER BY updated_at DESC;');
  console.log('\n--- LIVE DEALER ACCOUNTS IN POSTGRESQL ---');
  console.table(dealers.rows);

  await client.end();
}

check();

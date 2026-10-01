import { getClient } from './db.mjs';

async function main() {
  const client = await getClient();
  try {
    await client.query('ALTER TABLE public.admin_accounts ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20)');
    await client.query("UPDATE public.admin_accounts SET mobile_number = '8000050580' WHERE email = 'admin@sunvinerenewable.com'");
    const res = await client.query('SELECT id, email, full_name, role, mobile_number FROM admin_accounts');
    console.log('Updated admin_accounts:', res.rows);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const client = new Client({
  host: process.env.PGHOST || 'aws-0-ap-south-1.pooler.supabase.com',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 6543,
  user: process.env.PGUSER || 'postgres.wyberzvcyrjipjqpotwe',
  password: process.env.PGPASSWORD || process.env.VITE_DB_PASSWORD || '',
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const sql = fs.readFileSync('supabase_extended_migration.sql', 'utf8');
  console.log('Running extended migration...');
  await client.query(sql);
  console.log('Extended migration applied successfully!\n');

  const res = await client.query(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
  `);

  console.log('--- ALL PUBLIC TABLES IN SUPABASE ---');
  for (const r of res.rows) {
    const c = await client.query(`SELECT count(*) FROM public."${r.table_name}"`);
    console.log(r.table_name.padEnd(30), '=>', c.rows[0].count, 'rows');
  }

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

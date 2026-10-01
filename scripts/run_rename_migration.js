import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

const config = {
  host: process.env.SUPABASE_DB_HOST || 'aws-0-ap-south-1.pooler.supabase.com',
  port: parseInt(process.env.SUPABASE_DB_PORT || '5432', 10),
  user: process.env.SUPABASE_DB_USER || 'postgres.wyberzvcyrjipjqpotwe',
  password: process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || 'Ge@286296sumit',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function runMigration() {
  const sqlFilePath = path.resolve('supabase_rename_account_tables.sql');
  console.log(`Reading migration SQL from: ${sqlFilePath}`);
  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client(config);
  await client.connect();
  console.log('Connected successfully!');

  try {
    console.log('Executing account tables renaming migration SQL...');
    await client.query(sql);
    console.log('Account tables renamed successfully!\n');

    // Verify all public tables in database
    console.log('--- PUBLIC TABLES IN SUPABASE NOW ---');
    const tablesRes = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    for (const row of tablesRes.rows) {
      const countRes = await client.query(`SELECT count(*) FROM public."${row.table_name}"`);
      console.log(`[${row.table_type.padEnd(10)}] ${row.table_name.padEnd(30)} => ${countRes.rows[0].count} rows`);
    }

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);

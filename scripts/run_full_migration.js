import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

const config = {
  host: process.env.PGHOST || 'aws-0-ap-south-1.pooler.supabase.com',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 6543,
  user: process.env.PGUSER || 'postgres.wyberzvcyrjipjqpotwe',
  password: process.env.PGPASSWORD || process.env.VITE_DB_PASSWORD || '',
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function runMigration() {
  const sqlFilePath = path.resolve('supabase_full_migration.sql');
  console.log(`Reading migration SQL from: ${sqlFilePath}`);
  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client(config);
  await client.connect();
  console.log('Connected successfully!');

  try {
    console.log('Executing master migration SQL...');
    await client.query(sql);
    console.log('Migration executed successfully!');

    // Verify tables and row counts
    console.log('\n--- VERIFYING TABLES & ROWS ---');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      const countRes = await client.query(`SELECT count(*) FROM public."${tableName}"`);
      console.log(`Table: ${tableName.padEnd(30)} | Rows: ${countRes.rows[0].count}`);
    }

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

runMigration();

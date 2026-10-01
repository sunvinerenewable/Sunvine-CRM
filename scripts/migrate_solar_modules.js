import pg from 'pg';
const { Client } = pg;

const config = {
  host: process.env.SUPABASE_DB_HOST || 'aws-0-ap-south-1.pooler.supabase.com',
  port: parseInt(process.env.SUPABASE_DB_PORT || '5432', 10),
  user: process.env.SUPABASE_DB_USER || 'postgres.wyberzvcyrjipjqpotwe',
  password: process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || 'Ge@286296sumit',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function migrate() {
  const client = new Client(config);
  await client.connect();
  console.log('Connected to PG!');

  await client.query(`
    ALTER TABLE public.solar_modules 
    ADD COLUMN IF NOT EXISTS dimensions TEXT DEFAULT '2278 × 1134 × 30 mm | 28 kg',
    ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false;
  `);

  console.log('Columns added/verified in public.solar_modules!');

  const info = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'solar_modules'
    ORDER BY ordinal_position;
  `);
  console.log('solar_modules columns now:', info.rows.map(r => r.column_name));

  await client.end();
}

migrate().catch(console.error);

import pg from 'pg';

const { Client } = pg;

async function run() {
  const poolerHost = 'aws-0-ap-south-1.pooler.supabase.com';
  console.log(`Connecting to Production (${poolerHost}) with user postgres.wyberzvcyrjipjqpotwe ...`);

  // Try standard passwords
  const passwords = [
    process.env.SUPABASE_DB_PASSWORD,
    'Sunvine@1251'
  ].filter(Boolean);

  for (const password of passwords) {
    const client = new Client({
      host: poolerHost,
      port: 6543,
      database: 'postgres',
      user: 'postgres.wyberzvcyrjipjqpotwe',
      password: password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    try {
      await client.connect();
      console.log('SUCCESSFULLY CONNECTED TO PRODUCTION DATABASE (wyberzvcyrjipjqpotwe)!');
      const res = await client.query(`
        SELECT table_name, 
               (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
        FROM (
          SELECT table_name, 
                 query_to_xml(format('select count(*) as cnt from %I', table_name), false, true, '') as xml_count
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ) t
        ORDER BY table_name;
      `);
      console.log('--- Production Database Tables & Exact Row Counts ---');
      res.rows.forEach(r => console.log(`${r.table_name.padEnd(30)} : ${r.row_count} rows`));
      await client.end();
      return;
    } catch (err) {
      console.log('Connection attempt failed:', err.message);
    }
  }
}

run().catch(e => console.error('Error:', e.message));

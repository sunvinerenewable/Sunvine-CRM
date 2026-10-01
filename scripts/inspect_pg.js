import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const dbPassword = process.env.PGPASSWORD || process.env.VITE_DB_PASSWORD || '';

const configs = [
  // 1. Direct host
  {
    host: 'db.wyberzvcyrjipjqpotwe.supabase.co',
    port: 5432,
    user: 'postgres',
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  },
  // 2. Direct host port 6543
  {
    host: 'db.wyberzvcyrjipjqpotwe.supabase.co',
    port: 6543,
    user: 'postgres',
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  },
  // 3. Pooler port 6543 with tenant user
  {
    host: 'aws-0-ap-south-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.wyberzvcyrjipjqpotwe',
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  },
  // 4. Pooler port 5432 session mode
  {
    host: 'aws-0-ap-south-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.wyberzvcyrjipjqpotwe',
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  }
];

async function tryConnect() {
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    console.log(`Trying config ${i + 1}: ${config.host}:${config.port} user: ${config.user}`);
    const client = new Client(config);
    try {
      await client.connect();
      console.log(`>>> SUCCESS on config ${i + 1}!\n`);

      // 1. Get all tables in public schema
      const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);

      const tables = tablesRes.rows.map(r => r.table_name);
      console.log(`Public tables found (${tables.length}):`, tables);

      const report = {};

      for (const table of tables) {
        // Count
        const countRes = await client.query(`SELECT count(*) FROM "${table}";`);
        const rowCount = parseInt(countRes.rows[0].count, 10);

        // Columns
        const colsRes = await client.query(`
          SELECT 
            column_name, 
            data_type, 
            udt_name,
            is_nullable, 
            column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `, [table]);

        // Sample rows
        let sampleRows = [];
        try {
          const sampleRes = await client.query(`SELECT * FROM "${table}" LIMIT 5;`);
          sampleRows = sampleRes.rows;
        } catch (e) {
          sampleRows = `Error: ${e.message}`;
        }

        report[table] = {
          rowCount,
          columnCount: colsRes.rows.length,
          columns: colsRes.rows,
          sampleRows
        };
      }

      fs.writeFileSync('./scripts/full_db_report.json', JSON.stringify(report, null, 2));
      console.log('Successfully saved database report to ./scripts/full_db_report.json');
      await client.end();
      return;
    } catch (err) {
      console.log(`Config ${i + 1} failed:`, err.message);
      try { await client.end(); } catch (_) {}
    }
  }
}

tryConnect();

const { Client } = require('./node_modules/pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: process.env.PGHOST || 'aws-0-ap-south-1.pooler.supabase.com',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
  user: process.env.PGUSER || 'postgres.wyberzvcyrjipjqpotwe',
  password: process.env.PGPASSWORD || process.env.VITE_DB_PASSWORD || '',
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function inspectDatabase() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database successfully!\n');

    // 1. Get all public tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables in public schema:`, tables);

    const schemaReport = {};

    for (const table of tables) {
      // Row count
      const countRes = await client.query(`SELECT count(*) FROM "${table}";`);
      const rowCount = parseInt(countRes.rows[0].count, 10);

      // Columns
      const colsRes = await client.query(`
        SELECT 
          column_name, 
          data_type, 
          udt_name,
          is_nullable, 
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      // Primary Key
      const pkRes = await client.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' 
          AND tc.table_schema = 'public' 
          AND tc.table_name = $1;
      `, [table]);

      const primaryKeys = pkRes.rows.map(r => r.column_name);

      // Foreign Keys
      const fkRes = await client.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1;
      `, [table]);

      // Sample Rows
      let sampleRows = [];
      try {
        const sampleRes = await client.query(`SELECT * FROM "${table}" LIMIT 5;`);
        sampleRows = sampleRes.rows;
      } catch (err) {
        sampleRows = `Error fetching samples: ${err.message}`;
      }

      schemaReport[table] = {
        rowCount,
        columnCount: colsRes.rows.length,
        primaryKeys,
        foreignKeys: fkRes.rows,
        columns: colsRes.rows,
        sampleRows
      };
    }

    const outputPath = path.join(__dirname, 'db_schema_dump.json');
    fs.writeFileSync(outputPath, JSON.stringify(schemaReport, null, 2));
    console.log('Saved schema dump to', outputPath);

  } catch (err) {
    console.error('Error inspecting database:', err);
  } finally {
    await client.end();
  }
}

inspectDatabase();

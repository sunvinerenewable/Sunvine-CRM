import { withClient } from './db.mjs';

async function inspect() {
  await withClient(async (client) => {
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'dealer_accounts'
      ORDER BY ordinal_position
    `);
    console.log('--- COLUMNS IN dealer_accounts ---');
    cols.rows.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));

    const rows = await client.query('SELECT * FROM dealer_accounts');
    console.log(`\n--- ALL DEALER ROWS IN DB (${rows.rows.length} total) ---`);
    rows.rows.forEach(r => {
      const sanitized = { ...r };
      if (sanitized.password_hash) sanitized.password_hash = '[EXISTS: ' + sanitized.password_hash.substring(0, 7) + '...]';
      console.log(sanitized);
    });
  });
}

inspect().catch(e => console.error(e.message));

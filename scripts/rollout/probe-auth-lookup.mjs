import { query, getSupabaseServiceClient } from '../../api/_lib/db.js';

async function testAuthLookup() {
  console.log('Testing Admin & Dealer DB Lookup under current active .env...');

  // 1. Try PostgreSQL query
  console.log('\n--- 1. Testing Direct PostgreSQL Query ---');
  try {
    const qRes = await query('SELECT count(*) FROM admin_accounts');
    console.log('✅ PostgreSQL connected! Admin accounts count:', qRes.rows[0].count);
  } catch (err) {
    console.log('❌ PostgreSQL query failed:', err.message);
  }

  // 2. Try Supabase Service Client
  console.log('\n--- 2. Testing Supabase Service Client ---');
  try {
    const db = getSupabaseServiceClient();
    const { data, error } = await db.from('admin_accounts').select('id, email, mobile_number, status');
    if (error) {
      console.log('❌ Supabase service client query failed:', error.message);
    } else {
      console.log('✅ Supabase service client connected! Admins found:', data);
    }
  } catch (err) {
    console.log('❌ Supabase service client exception:', err.message);
  }
}

testAuthLookup().catch(e => console.error('Error:', e.message));

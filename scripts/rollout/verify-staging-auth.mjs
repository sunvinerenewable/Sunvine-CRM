import { getSupabaseServiceClient } from '../../api/_lib/db.js';
import bcrypt from 'bcryptjs';

async function syncAndVerifyStaging() {
  console.log('--- 1. Setting up Admin in Staging DB (voyargkmlkrlidyxjcbk) ---');
  const db = getSupabaseServiceClient();

  const adminHash = await bcrypt.hash('admin123', 10);
  const { data: adminUpsert, error: adminErr } = await db.from('admin_accounts').upsert({
    email: 'admin@sunvinerenewable.com',
    mobile_number: '8000050580',
    full_name: 'Super Administrator',
    role: 'super_admin',
    password_hash: adminHash,
    status: 'active'
  }, { onConflict: 'email' }).select();

  if (adminErr) {
    console.error('❌ Admin upsert failed in Staging:', adminErr.message);
  } else {
    console.log('✅ Admin synced in Staging DB:', adminUpsert?.[0]?.email, adminUpsert?.[0]?.mobile_number);
  }

  // Verify Admin Login on Staging
  const { data: adminCheck } = await db.from('admin_accounts').select('*').eq('mobile_number', '8000050580');
  if (adminCheck?.length > 0) {
    const isMatch = await bcrypt.compare('admin123', adminCheck[0].password_hash);
    console.log('🔑 Staging Admin password check for "admin123":', isMatch ? '✅ MATCHES (SUCCESS)' : '❌ FAILED');
  }

  // Verify Dealer Login on Staging
  const { data: dealerCheck } = await db.from('dealer_accounts').select('*').eq('mobile_number', '9825658566');
  if (dealerCheck?.length > 0) {
    const isMatch = await bcrypt.compare('dinesh123', dealerCheck[0].password_hash);
    console.log('🔑 Staging Dealer (KITCHEN KING) password check for "dinesh123":', isMatch ? '✅ MATCHES (SUCCESS)' : '❌ FAILED');
  }
}

syncAndVerifyStaging().catch(e => console.error(e.message));

import { getSupabaseServiceClient } from '../../api/_lib/db.js';
import bcrypt from 'bcryptjs';

async function testAdmin() {
  const db = getSupabaseServiceClient();
  const { data, error } = await db.from('admin_accounts').select('*').or('email.ilike.admin@sunvinerenewable.com,mobile_number.eq.8000050580');

  if (error || !data || data.length === 0) {
    console.error('❌ Admin lookup failed:', error?.message);
    return;
  }

  const admin = data[0];
  console.log('✅ Admin found in Production DB:');
  console.log({
    id: admin.id,
    email: admin.email,
    mobile: admin.mobile_number,
    role: admin.role,
    status: admin.status,
    has_hash: Boolean(admin.password_hash)
  });

  const passwords = ['admin123', 'Sunvine@1251', 'Admin@123', 'admin@123'];
  for (const p of passwords) {
    const isMatch = await bcrypt.compare(p, admin.password_hash);
    console.log(`Password check for "${p}":`, isMatch ? '✅ MATCHES (SUCCESS)' : '❌ No match');
    if (isMatch) break;
  }
}

testAdmin().catch(e => console.error(e.message));

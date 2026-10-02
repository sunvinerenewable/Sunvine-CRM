import { createClient } from '@supabase/supabase-js';
import { getEnvConfig } from './db.mjs';

async function verifyLockdown() {
  console.log('=== Verifying Database RLS Lockdown with Public Anon Key ===\n');

  const config = getEnvConfig();
  const anonClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  // 1. Attempt to read admin_accounts
  const adminRes = await anonClient.from('admin_accounts').select('id, email, password_hash');
  console.log(`1. Anonymous SELECT on admin_accounts: returned ${adminRes.data?.length ?? 0} rows (Error: ${adminRes.error?.message || 'none'})`);

  // 2. Attempt to read dealer_accounts
  const dealerRes = await anonClient.from('dealer_accounts').select('id, mobile_number, password_hash');
  console.log(`2. Anonymous SELECT on dealer_accounts: returned ${dealerRes.data?.length ?? 0} rows (Error: ${dealerRes.error?.message || 'none'})`);

  // 3. Attempt to read staff_accounts
  const staffRes = await anonClient.from('staff_accounts').select('id, email, password_hash');
  console.log(`3. Anonymous SELECT on staff_accounts: returned ${staffRes.data?.length ?? 0} rows (Error: ${staffRes.error?.message || 'none'})`);

  // 4. Attempt to read otp_verifications
  const otpRes = await anonClient.from('otp_verifications').select('*');
  console.log(`4. Anonymous SELECT on otp_verifications: returned ${otpRes.data?.length ?? 0} rows (Error: ${otpRes.error?.message || 'none'})`);

  // 5. Attempt to read solar_modules catalog (should be allowed read-only)
  const modRes = await anonClient.from('solar_modules').select('id, brand, rate_per_wp_inr');
  console.log(`5. Anonymous SELECT on solar_modules catalog: returned ${modRes.data?.length ?? 0} rows (Expected: allowed read-only)`);

  const isSecure = (adminRes.data?.length ?? 0) === 0 &&
                   (dealerRes.data?.length ?? 0) === 0 &&
                   (staffRes.data?.length ?? 0) === 0 &&
                   (otpRes.data?.length ?? 0) === 0 &&
                   (modRes.data?.length ?? 0) > 0;

  if (isSecure) {
    console.log('\n🔒 SECURITY VERIFICATION PASSED: Anonymous access to all sensitive tables is completely blocked!');
  } else {
    console.error('\n❌ SECURITY VERIFICATION FAILED: Some sensitive data is still readable anonymously.');
    process.exit(1);
  }
}

verifyLockdown().catch(err => {
  console.error('Lockdown verification failed:', err);
  process.exit(1);
});

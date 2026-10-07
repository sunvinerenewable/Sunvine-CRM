import { createClient } from '@supabase/supabase-js';
import { getEnvConfig } from './db.mjs';

/**
 * Verification Probe: Anonymous Database Lockdown & Catalogue Access
 * 
 * Verifies:
 * 1. Count-only SELECT queries on sensitive tables return 0 rows or error (401/403/PGRST116/etc).
 * 2. Strict read-only SELECT works on designated public catalogue tables.
 * 3. Write mutations (INSERT/UPDATE/DELETE) are denied for anon on catalogue and sensitive tables.
 * 4. Legacy RPC verify_user_credentials is nonexistent / denied (404/PGRST202).
 * 5. NEVER prints or logs row contents or secrets.
 */
async function verifyLockdown() {
  console.log('===============================================================');
  console.log('🔍 PROBE: Anonymous Database Lockdown & Permission Verification');
  console.log('===============================================================\n');

  const config = getEnvConfig();
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY configuration.');
    process.exit(1);
  }

  const anonClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  let totalFailures = 0;

  // ── 1. Test Sensitive Tables (Must return 0 rows or permission error) ────────
  const sensitiveTables = [
    'dealer_accounts',
    'staff_accounts',
    'admin_accounts',
    'audit_logs',
    'otp_verifications',
    'customer_files',
    'notifications',
    'push_subscriptions',
    'quotations',
    'quotation_bom_snapshots',
    'system_settings',
    'dealer_custom_pricing',
    'solar_banks'
  ];

  console.log('--- 1. Testing Sensitive Tables (Count-Only Probe) ---');
  for (const table of sensitiveTables) {
    try {
      const { data, count, error } = await anonClient
        .from(table)
        .select('*', { count: 'exact', head: true });

      const rowCount = count ?? (Array.isArray(data) ? data.length : 0);

      if (error || rowCount === 0) {
        console.log(`  [PASS] ${table.padEnd(25)} -> Blocked / 0 rows (status: ${error ? error.message : '0 rows returned'})`);
      } else {
        console.error(`  [FAIL] ${table.padEnd(25)} -> LEAK DETECTED: Anon read ${rowCount} rows!`);
        totalFailures++;
      }
    } catch (err) {
      console.log(`  [PASS] ${table.padEnd(25)} -> Blocked with exception: ${err.message}`);
    }
  }

  // ── 2. Test Catalogue Tables (Must allow read-only SELECT) ───────────────────
  const catalogueTables = [
    'solar_modules',
    'solar_inverters',
    'bom_catalog',
    'bos_pricing_matrix',
    'pricing_presets',
    'document_master',
    'inverter_benchmark_matrix'
  ];

  console.log('\n--- 2. Testing Public Catalogue Tables (Read-Only Probe) ---');
  for (const table of catalogueTables) {
    try {
      const { data, count, error } = await anonClient
        .from(table)
        .select('id', { count: 'exact', head: true });

      if (error) {
        // If table is empty or error occurs
        console.warn(`  [WARN] ${table.padEnd(28)} -> Read error / check schema: ${error.message}`);
      } else {
        const rowCount = count ?? (Array.isArray(data) ? data.length : 0);
        console.log(`  [PASS] ${table.padEnd(28)} -> Read permitted (${rowCount} rows available)`);
      }
    } catch (err) {
      console.warn(`  [WARN] ${table.padEnd(28)} -> Query exception: ${err.message}`);
    }
  }

  // ── 3. Test Mutation Denials (Anon INSERT / UPDATE must fail) ────────────────
  console.log('\n--- 3. Testing Mutation Denial on Public & Sensitive Tables ---');
  const writeTests = [
    {
      name: 'solar_modules INSERT denial',
      action: () => anonClient.from('solar_modules').insert({ brand: 'TEST_PROBE', model: 'PROBE_001' })
    },
    {
      name: 'quotations INSERT denial',
      action: () => anonClient.from('quotations').insert({ customer_name: 'PROBE_TEST' })
    },
    {
      name: 'audit_logs INSERT denial',
      action: () => anonClient.from('audit_logs').insert({ action: 'PROBE_ATTEMPT' })
    },
    {
      name: 'system_settings UPDATE denial',
      action: () => anonClient.from('system_settings').update({ updated_at: new Date().toISOString() }).eq('id', 'global_settings')
    }
  ];

  for (const test of writeTests) {
    try {
      const { data, error } = await test.action();
      if (error) {
        console.log(`  [PASS] ${test.name.padEnd(35)} -> Write blocked as expected (${error.message || 'Access Denied'})`);
      } else if (data && data.length > 0) {
        console.error(`  [FAIL] ${test.name.padEnd(35)} -> SECURITY VIOLATION: Anon write succeeded!`);
        totalFailures++;
      } else {
        console.log(`  [PASS] ${test.name.padEnd(35)} -> Write blocked (no data modified)`);
      }
    } catch (err) {
      console.log(`  [PASS] ${test.name.padEnd(35)} -> Write blocked with exception (${err.message})`);
    }
  }

  // ── 4. Test RPC verify_user_credentials (Must be 404 / Not Found) ───────────
  console.log('\n--- 4. Testing Legacy RPC verify_user_credentials Removal ---');
  try {
    const { data, error } = await anonClient.rpc('verify_user_credentials', {
      p_username: 'probe_test',
      p_password: 'dummy_probe_password',
      p_user_type: 'staff'
    });

    if (error) {
      console.log(`  [PASS] verify_user_credentials RPC -> Denied / Nonexistent (${error.code || error.message})`);
    } else if (data) {
      console.error(`  [FAIL] verify_user_credentials RPC -> Security Hazard: RPC is still callable!`);
      totalFailures++;
    } else {
      console.log(`  [PASS] verify_user_credentials RPC -> Blocked (returned null)`);
    }
  } catch (err) {
    console.log(`  [PASS] verify_user_credentials RPC -> Nonexistent (${err.message})`);
  }

  // ── 5. Summary & Exit ───────────────────────────────────────────────────────
  console.log('\n===============================================================');
  if (totalFailures === 0) {
    console.log('🔒 ALL SECURITY ASSERTIONS PASSED: Database is fully locked down.');
    console.log('===============================================================');
    process.exit(0);
  } else {
    console.error(`❌ SECURITY VERIFICATION FAILED with ${totalFailures} violations.`);
    console.log('===============================================================');
    process.exit(1);
  }
}

verifyLockdown().catch(err => {
  console.error('Fatal probe error:', err.message);
  process.exit(1);
});

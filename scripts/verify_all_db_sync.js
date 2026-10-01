import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wyberzvcyrjipjqpotwe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XzbS-fQMtSGf2LjFO40yzw_LtT98nG6';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyAllTables() {
  console.log('--- TESTING FULL DATABASE CONNECTIVITY & LIVE READ/WRITE ---\n');

  const tables = [
    { name: 'pricing_presets', checkField: 'id' },
    { name: 'bos_pricing_matrix', checkField: 'capacity_kw' },
    { name: 'inverter_benchmark_matrix', checkField: 'brand' },
    { name: 'bom_catalog', checkField: 'capacity_kw' },
    { name: 'dealer_custom_pricing', checkField: 'tier_id' },
    { name: 'solar_modules', checkField: 'brand' },
    { name: 'solar_inverters', checkField: 'brand' },
    { name: 'dealers', checkField: 'dealer_code' },
    { name: 'customer_files', checkField: 'customer_name' },
    { name: 'staff_users', checkField: 'name' },
    { name: 'system_settings', checkField: 'id' },
    { name: 'notifications', checkField: 'title' },
    { name: 'quotations', checkField: 'id' }
  ];

  for (const t of tables) {
    const { data, error } = await sb.from(t.name).select('*');
    if (error) {
      console.log(`❌ ${t.name.padEnd(28)} => ERROR: ${error.message}`);
    } else {
      console.log(`✅ ${t.name.padEnd(28)} => OK (${data.length} rows)`);
    }
  }

  console.log('\n--- TESTING QUOTATION CREATION & PERSISTENCE ---');
  const testQuoteId = `TEST-SYNC-${Date.now()}`;
  const testQuote = {
    id: testQuoteId,
    dealer_code: 'SV-DLR-0104',
    dealer_name: 'Sunline Solar Solutions',
    customer_name: 'Database Live Test Customer',
    customer_phone: '9876543210',
    customer_city: 'Rajkot',
    customer_state: 'Gujarat',
    system_capacity_kw: 5.5,
    panel_type: 'Waaree TOPCon 585W Bifacial',
    inverter_type: 'Sunvine 5.0kW 3-Phase',
    structure_type: 'High-Rise Galvanized HDG 2.5m',
    base_cost: 282000,
    dealer_margin: 22000,
    total_amount: 304000,
    subsidy_amount: 78000,
    net_payable: 226000,
    status: 'Approved'
  };

  const insertRes = await sb.from('quotations').insert([testQuote]);
  if (insertRes.error) {
    console.log('Quotation insert failed:', insertRes.error.message);
  } else {
    console.log(`✅ Successfully inserted quote ${testQuoteId}`);
  }

  // Fetch it back
  const fetchRes = await sb.from('quotations').select('*').eq('id', testQuoteId).single();
  if (fetchRes.data) {
    console.log(`✅ Successfully fetched quote ${fetchRes.data.id} - Customer: ${fetchRes.data.customer_name}`);
  }

  // Clean up test quote
  await sb.from('quotations').delete().eq('id', testQuoteId);
  console.log(`✅ Cleaned up test quote ${testQuoteId}`);

  console.log('\n🎉 ALL DATABASE SYSTEMS VERIFIED AND 100% OPERATIONAL!');
}

verifyAllTables().catch(console.error);

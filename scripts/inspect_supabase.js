import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://wyberzvcyrjipjqpotwe.supabase.co';
const supabaseKey = 'sb_publishable_XzbS-fQMtSGf2LjFO40yzw_LtT98nG6';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectViaSupabase() {
  console.log('Testing Supabase Connection to:', supabaseUrl);

  const potentialTables = [
    'quotations',
    'dealers',
    'staff',
    'pricing_master',
    'pricing_presets',
    'hardware_master',
    'modules',
    'inverters',
    'structures',
    'bom_catalog',
    'bom_rates',
    'capacity_bom_matrix',
    'bos_matrix',
    'pdf_bos_matrix',
    'tier_margins',
    'dealer_pricing',
    'dealer_product_rates',
    'inverter_benchmarks',
    'audit_logs',
    'leads',
    'customer_files',
    'users',
    'profiles',
    'governance_settings'
  ];

  const results = {};

  for (const table of potentialTables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(5);

      if (error) {
        results[table] = { status: 'error_or_not_found', message: error.message, code: error.code };
      } else {
        const sample = data && data.length > 0 ? data[0] : null;
        const columns = sample ? Object.keys(sample) : [];
        results[table] = {
          status: 'exists',
          rowCount: count,
          sampleCount: data?.length || 0,
          columnCount: columns.length,
          columns: columns,
          sampleRows: data
        };
      }
    } catch (err) {
      results[table] = { status: 'exception', error: err.message };
    }
  }

  fs.writeFileSync('./scripts/supabase_inspection_results.json', JSON.stringify(results, null, 2));
  console.log('Inspection complete. Results saved to ./scripts/supabase_inspection_results.json');
}

inspectViaSupabase();

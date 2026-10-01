import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wyberzvcyrjipjqpotwe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XzbS-fQMtSGf2LjFO40yzw_LtT98nG6';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seedCleanQuotations() {
  console.log('Seeding real valid quotations into Supabase DB...');

  const quotes = [
    {
      id: 'SV-2026-Q801',
      dealer_code: 'SV-DLR-0104',
      dealer_name: 'Sunline Solar Solutions',
      customer_name: 'Anand Sharma',
      customer_phone: '9876543210',
      customer_city: 'Ahmedabad',
      customer_state: 'Gujarat',
      system_capacity_kw: 5.0,
      panel_type: 'Waaree Energies TOPCon 585W Bifacial',
      inverter_type: 'Sunvine Smart Series 5.0 kW 3-Phase',
      structure_type: 'High-Rise Galvanized HDG 2.5m',
      base_cost: 275000.00,
      dealer_margin: 20000.00,
      total_amount: 295000.00,
      subsidy_amount: 78000.00,
      net_payable: 217000.00,
      annual_generation_kwh: 7500.00,
      status: 'Approved',
      quote_payload: {
        id: 'SV-2026-Q801',
        quoteNumber: 'SV-2026-Q801',
        customerName: 'Anand Sharma',
        customerPhone: '9876543210',
        city: 'Ahmedabad',
        state: 'Gujarat',
        systemCapacityKW: 5.0,
        panelBrand: 'Waaree Energies',
        panelWattage: 585,
        panelCount: 9,
        inverterBrand: 'Sunvine Smart Series',
        inverterCapacityKW: 5.0,
        baseRatePerKW: 55000,
        baseCost: 275000,
        dealerMarginPerKW: 4000,
        dealerTotalMargin: 20000,
        totalAmount: 295000,
        grandTotalCustomer: 295000,
        subsidyAmount: 78000,
        netPayable: 217000,
        status: 'Approved',
        date: '2026-09-25',
        dealerId: 'SV-DLR-0104',
        dealerCode: 'SV-DLR-0104',
        dealerName: 'Sunline Solar Solutions'
      }
    },
    {
      id: 'SV-2026-Q802',
      dealer_code: 'SV-DLR-0001',
      dealer_name: 'Rajkot Solar Tech',
      customer_name: 'Rajeshbhai Patel',
      customer_phone: '9825112345',
      customer_city: 'Rajkot',
      customer_state: 'Gujarat',
      system_capacity_kw: 3.3,
      panel_type: 'APS / Sunvine Premier 600WP TOPCon Bifacial',
      inverter_type: 'Sunvine Smart Series 3.0 kW 1-Phase',
      structure_type: 'High-Rise Galvanized HDG 2.5m',
      base_cost: 182500.00,
      dealer_margin: 14850.00,
      total_amount: 197350.00,
      subsidy_amount: 78000.00,
      net_payable: 119350.00,
      annual_generation_kwh: 4950.00,
      status: 'Draft',
      quote_payload: {
        id: 'SV-2026-Q802',
        quoteNumber: 'SV-2026-Q802',
        customerName: 'Rajeshbhai Patel',
        customerPhone: '9825112345',
        city: 'Rajkot',
        state: 'Gujarat',
        systemCapacityKW: 3.3,
        panelBrand: 'APS / Sunvine Premier',
        panelWattage: 600,
        panelCount: 6,
        inverterBrand: 'Sunvine Smart Series',
        inverterCapacityKW: 3.0,
        baseRatePerKW: 55303,
        baseCost: 182500,
        dealerMarginPerKW: 4500,
        dealerTotalMargin: 14850,
        totalAmount: 197350,
        grandTotalCustomer: 197350,
        subsidyAmount: 78000,
        netPayable: 119350,
        status: 'Draft',
        date: '2026-09-28',
        dealerId: 'SV-DLR-0001',
        dealerCode: 'SV-DLR-0001',
        dealerName: 'Rajkot Solar Tech'
      }
    }
  ];

  for (const q of quotes) {
    const { error } = await sb.from('quotations').upsert([q], { onConflict: 'id' });
    if (error) console.error('Error inserting quote:', error.message);
    else console.log(`✅ Upserted live quotation ${q.id}`);
  }
}

seedCleanQuotations().catch(console.error);

import { withClient } from './db.mjs';

const MATRIX = [
  { capacity_kw: 2.2, no_of_modules: 4, inverter_capacity_kw: '2.2KW', adani_bifi_price: 117882, aps_bifi_price: 104500, rayzone_price: 104500, waaree_540_price: 114696, topcon585_capacity_kw: 2.34, waaree_585_price: 126360, topcon600_capacity_kw: 2.40, aps_topcon_600_price: 117600 },
  { capacity_kw: 2.75, no_of_modules: 5, inverter_capacity_kw: '3KW', adani_bifi_price: 138195, aps_bifi_price: 123750, rayzone_price: 123750, waaree_540_price: 134460, topcon585_capacity_kw: 2.925, waaree_585_price: 149175, topcon600_capacity_kw: 3.00, aps_topcon_600_price: 141600 },
  { capacity_kw: 3.3, no_of_modules: 6, inverter_capacity_kw: '3.6KW', adani_bifi_price: 160173, aps_bifi_price: 148500, rayzone_price: 148500, waaree_540_price: 155844, topcon585_capacity_kw: 3.51, waaree_585_price: 173043, topcon600_capacity_kw: 3.60, aps_topcon_600_price: 164520 },
  { capacity_kw: 3.85, no_of_modules: 7, inverter_capacity_kw: '3.6KW', adani_bifi_price: 186131, aps_bifi_price: 173250, rayzone_price: 173250, waaree_540_price: 181100, topcon585_capacity_kw: 4.095, waaree_585_price: 204750, topcon600_capacity_kw: 4.20, aps_topcon_600_price: 196140 },
  { capacity_kw: 4.4, no_of_modules: 8, inverter_capacity_kw: '4/4.2KW', adani_bifi_price: 208680, aps_bifi_price: 194480, rayzone_price: 194480, waaree_540_price: 203040, topcon585_capacity_kw: 4.68, waaree_585_price: 229320, topcon600_capacity_kw: 4.80, aps_topcon_600_price: 224160 },
  { capacity_kw: 4.95, no_of_modules: 9, inverter_capacity_kw: '5/5.2KW', adani_bifi_price: 238761, aps_bifi_price: 218790, rayzone_price: 218790, waaree_540_price: 232308, topcon585_capacity_kw: 5.265, waaree_585_price: 256932, topcon600_capacity_kw: 5.40, aps_topcon_600_price: 248400 },
  { capacity_kw: 5.5, no_of_modules: 10, inverter_capacity_kw: '6KW', adani_bifi_price: 263070, aps_bifi_price: 243100, rayzone_price: 243100, waaree_540_price: 255960, topcon585_capacity_kw: 5.85, waaree_585_price: 280800, topcon600_capacity_kw: 6.00, aps_topcon_600_price: 276000 },
  { capacity_kw: 6.05, no_of_modules: 11, inverter_capacity_kw: '6KW', adani_bifi_price: 286935, aps_bifi_price: 266200, rayzone_price: 266200, waaree_540_price: 279180, topcon585_capacity_kw: 6.435, waaree_585_price: 308880, topcon600_capacity_kw: 6.60, aps_topcon_600_price: 303600 },
  { capacity_kw: 6.6, no_of_modules: 12, inverter_capacity_kw: '6KW', adani_bifi_price: 312000, aps_bifi_price: 290400, rayzone_price: 290400, waaree_540_price: 304560, topcon585_capacity_kw: 7.02, waaree_585_price: 336960, topcon600_capacity_kw: 7.20, aps_topcon_600_price: 331200 },
  { capacity_kw: 7.7, no_of_modules: 14, inverter_capacity_kw: '8KW', adani_bifi_price: 364000, aps_bifi_price: 338800, rayzone_price: 338800, waaree_540_price: 355320, topcon585_capacity_kw: 8.19, waaree_585_price: 393120, topcon600_capacity_kw: 8.40, aps_topcon_600_price: 386400 },
  { capacity_kw: 8.25, no_of_modules: 15, inverter_capacity_kw: '8KW', adani_bifi_price: 390000, aps_bifi_price: 363000, rayzone_price: 363000, waaree_540_price: 380700, topcon585_capacity_kw: 8.775, waaree_585_price: 421200, topcon600_capacity_kw: 9.00, aps_topcon_600_price: 414000 },
  { capacity_kw: 8.8, no_of_modules: 16, inverter_capacity_kw: '8KW', adani_bifi_price: 416000, aps_bifi_price: 387200, rayzone_price: 387200, waaree_540_price: 406080, topcon585_capacity_kw: 9.36, waaree_585_price: 449280, topcon600_capacity_kw: 9.60, aps_topcon_600_price: 441600 },
  { capacity_kw: 9.35, no_of_modules: 17, inverter_capacity_kw: '10KW', adani_bifi_price: 442000, aps_bifi_price: 411400, rayzone_price: 411400, waaree_540_price: 431460, topcon585_capacity_kw: 9.945, waaree_585_price: 477360, topcon600_capacity_kw: 10.20, aps_topcon_600_price: 469200 },
  { capacity_kw: 9.9, no_of_modules: 18, inverter_capacity_kw: '10KW', adani_bifi_price: 468000, aps_bifi_price: 435600, rayzone_price: 435600, waaree_540_price: 456840, topcon585_capacity_kw: 10.53, waaree_585_price: 505440, topcon600_capacity_kw: 10.80, aps_topcon_600_price: 496800 },
  { capacity_kw: 10.45, no_of_modules: 19, inverter_capacity_kw: '10KW', adani_bifi_price: 494000, aps_bifi_price: 459800, rayzone_price: 459800, waaree_540_price: 482220, topcon585_capacity_kw: 11.115, waaree_585_price: 533520, topcon600_capacity_kw: 11.40, aps_topcon_600_price: 524400 }
];

const MODULES = [
  { id: 'mod-aps-600', brand: 'APS / Sunvine Premier', model: '600WP TOPCON MONO BIFACIAL Panel', wattage: 600, cell_tech: 'TOPCon Mono Bifacial', efficiency: '22.8%', rate_per_wp: '₹ 24.00/Wp', rate_per_wp_inr: 24.00, is_default: true },
  { id: 'mod-waaree-585', brand: 'Waaree Energies', model: '585WP TOPCon Bifacial Dual Glass (HyperIon)', wattage: 585, cell_tech: 'TOPCon Mono Bifacial', efficiency: '22.4%', rate_per_wp: '₹ 26.80/Wp', rate_per_wp_inr: 26.80, is_default: false },
  { id: 'mod-waaree-540', brand: 'Waaree Energies', model: '540W Mono PERC Half-Cut Module', wattage: 540, cell_tech: 'Mono PERC Bifacial', efficiency: '21.5%', rate_per_wp: '₹ 22.50/Wp', rate_per_wp_inr: 22.50, is_default: false },
  { id: 'mod-waaree-610', brand: 'Waaree Energies', model: '610W/620W TOPCon Bifacial Dual Glass', wattage: 610, cell_tech: 'TOPCon Mono Bifacial', efficiency: '23.0%', rate_per_wp: '₹ 27.50/Wp', rate_per_wp_inr: 27.50, is_default: false },
  { id: 'mod-adani-550', brand: 'Adani Solar', model: 'Elan Bi-550W Mono PERC Half-Cut', wattage: 550, cell_tech: 'Mono PERC Bifacial', efficiency: '21.8%', rate_per_wp: '₹ 22.50/Wp', rate_per_wp_inr: 22.50, is_default: false },
  { id: 'mod-adani-600', brand: 'Adani Solar', model: '600W Vertex TOPCon Bifacial', wattage: 600, cell_tech: 'TOPCon Mono Bifacial', efficiency: '22.6%', rate_per_wp: '₹ 24.00/Wp', rate_per_wp_inr: 24.00, is_default: false },
  { id: 'mod-aps-550', brand: 'APS Bi-Fi', model: '550W Bifacial Dual Glass', wattage: 550, cell_tech: 'TOPCon Mono Bifacial', efficiency: '21.6%', rate_per_wp: '₹ 22.50/Wp', rate_per_wp_inr: 22.50, is_default: false },
  { id: 'mod-rayzone-550', brand: 'Rayzone Solar', model: '550W Bi-Fi Mono PERC Half-Cut', wattage: 550, cell_tech: 'Mono PERC Bifacial', efficiency: '21.6%', rate_per_wp: '₹ 22.70/Wp', rate_per_wp_inr: 22.70, is_default: false }
];

async function updateDbPricing() {
  console.log('Connecting to database to update pricing...');
  await withClient(async (client) => {
    // 1. Update bos_pricing_matrix
    console.log('Updating bos_pricing_matrix...');
    for (const row of MATRIX) {
      const id = `bos-${String(row.capacity_kw).replace('.', '_')}`;
      await client.query(`
        INSERT INTO public.bos_pricing_matrix 
          (id, capacity_kw, no_of_modules, inverter_capacity_kw, adani_bifi_price, aps_bifi_price, rayzone_price, topcon585_capacity_kw, waaree_585_price, topcon600_capacity_kw, aps_topcon_600_price, updated_at)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (id) DO UPDATE SET
          capacity_kw = EXCLUDED.capacity_kw,
          no_of_modules = EXCLUDED.no_of_modules,
          inverter_capacity_kw = EXCLUDED.inverter_capacity_kw,
          adani_bifi_price = EXCLUDED.adani_bifi_price,
          aps_bifi_price = EXCLUDED.aps_bifi_price,
          rayzone_price = EXCLUDED.rayzone_price,
          topcon585_capacity_kw = EXCLUDED.topcon585_capacity_kw,
          waaree_585_price = EXCLUDED.waaree_585_price,
          topcon600_capacity_kw = EXCLUDED.topcon600_capacity_kw,
          aps_topcon_600_price = EXCLUDED.aps_topcon_600_price,
          updated_at = NOW()
      `, [
        id, row.capacity_kw, row.no_of_modules, row.inverter_capacity_kw,
        row.adani_bifi_price, row.aps_bifi_price, row.rayzone_price,
        row.topcon585_capacity_kw, row.waaree_585_price,
        row.topcon600_capacity_kw, row.aps_topcon_600_price
      ]);
    }
    console.log(`✓ bos_pricing_matrix updated (${MATRIX.length} slabs).`);

    // 2. Update solar_modules
    console.log('Updating solar_modules catalog...');
    for (const mod of MODULES) {
      await client.query(`
        INSERT INTO public.solar_modules
          (id, brand, model, wattage, cell_tech, efficiency, rate_per_wp, rate_per_wp_inr, warranty, is_default, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, '30 Years Performance', $9, NOW())
        ON CONFLICT (id) DO UPDATE SET
          brand = EXCLUDED.brand,
          model = EXCLUDED.model,
          wattage = EXCLUDED.wattage,
          cell_tech = EXCLUDED.cell_tech,
          efficiency = EXCLUDED.efficiency,
          rate_per_wp = EXCLUDED.rate_per_wp,
          rate_per_wp_inr = EXCLUDED.rate_per_wp_inr,
          is_default = EXCLUDED.is_default,
          updated_at = NOW()
      `, [
        mod.id, mod.brand, mod.model, mod.wattage, mod.cell_tech,
        mod.efficiency, mod.rate_per_wp, mod.rate_per_wp_inr, mod.is_default
      ]);
    }
    console.log(`✓ solar_modules updated (${MODULES.length} modules).`);
  });
  console.log('🎉 Database pricing synchronization completed successfully!');
}

updateDbPricing().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

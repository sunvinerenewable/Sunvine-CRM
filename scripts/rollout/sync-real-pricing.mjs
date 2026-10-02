import { withClient } from './db.mjs';

const MATRIX = [
  { capacity_kw: 2.2, no_of_modules: 4, inverter_capacity_kw: '2.2', adani_bifi_price: 100397, aps_bifi_price: 92950, rayzone_price: 93412, topcon585_capacity_kw: 2.34, waaree_585_price: 106823, topcon600_capacity_kw: 2.4, aps_topcon_600_price: 101455 },
  { capacity_kw: 2.75, no_of_modules: 5, inverter_capacity_kw: '3', adani_bifi_price: 119721, aps_bifi_price: 110298, rayzone_price: 110875, topcon585_capacity_kw: 2.925, waaree_585_price: 127639, topcon600_capacity_kw: 3, aps_topcon_600_price: 120929 },
  { capacity_kw: 3.3, no_of_modules: 6, inverter_capacity_kw: '3.6', adani_bifi_price: 138385, aps_bifi_price: 127500, rayzone_price: 128193, topcon585_capacity_kw: 3.51, waaree_585_price: 148308, topcon600_capacity_kw: 3.6, aps_topcon_600_price: 140257 },
  { capacity_kw: 3.85, no_of_modules: 7, inverter_capacity_kw: '3.6', adani_bifi_price: 159140, aps_bifi_price: 145722, rayzone_price: 146531, topcon585_capacity_kw: 4.095, waaree_585_price: 169999, topcon600_capacity_kw: 4.2, aps_topcon_600_price: 160606 },
  { capacity_kw: 4.4, no_of_modules: 8, inverter_capacity_kw: '4.2/4.4', adani_bifi_price: 181874, aps_bifi_price: 170200, rayzone_price: 171124, topcon585_capacity_kw: 4.68, waaree_585_price: 197945, topcon600_capacity_kw: 4.8, aps_topcon_600_price: 187210 },
  { capacity_kw: 4.95, no_of_modules: 9, inverter_capacity_kw: '5', adani_bifi_price: 199878, aps_bifi_price: 186698, rayzone_price: 187737, topcon585_capacity_kw: 5.265, waaree_585_price: 217911, topcon600_capacity_kw: 5.4, aps_topcon_600_price: 205834 },
  { capacity_kw: 5.5, no_of_modules: 10, inverter_capacity_kw: '5', adani_bifi_price: 218542, aps_bifi_price: 203926, rayzone_price: 205081, topcon585_capacity_kw: 5.85, waaree_585_price: 238607, topcon600_capacity_kw: 6, aps_topcon_600_price: 225188 },
  { capacity_kw: 6.6, no_of_modules: 12, inverter_capacity_kw: '6', adani_bifi_price: 262251, aps_bifi_price: 244530, rayzone_price: 245916, topcon585_capacity_kw: 7.02, waaree_585_price: 286148, topcon600_capacity_kw: 7.2, aps_topcon_600_price: 270045 },
  { capacity_kw: 7.7, no_of_modules: 14, inverter_capacity_kw: '8', adani_bifi_price: 315969, aps_bifi_price: 296066, rayzone_price: 297683, topcon585_capacity_kw: 8.19, waaree_585_price: 344620, topcon600_capacity_kw: 8.4, aps_topcon_600_price: 325833 },
  { capacity_kw: 8.25, no_of_modules: 15, inverter_capacity_kw: '8', adani_bifi_price: 334964, aps_bifi_price: 313582, rayzone_price: 315315, topcon585_capacity_kw: 8.775, waaree_585_price: 365605, topcon600_capacity_kw: 9, aps_topcon_600_price: 345476 },
  { capacity_kw: 8.8, no_of_modules: 16, inverter_capacity_kw: '8', adani_bifi_price: 353628, aps_bifi_price: 330770, rayzone_price: 332618, topcon585_capacity_kw: 9.36, waaree_585_price: 386260, topcon600_capacity_kw: 9.6, aps_topcon_600_price: 364790 },
  { capacity_kw: 9.35, no_of_modules: 17, inverter_capacity_kw: '10', adani_bifi_price: 381212, aps_bifi_price: 357638, rayzone_price: 359601, topcon585_capacity_kw: 9.945, waaree_585_price: 416596, topcon600_capacity_kw: 10.2, aps_topcon_600_price: 393784 },
  { capacity_kw: 9.9, no_of_modules: 18, inverter_capacity_kw: '10', adani_bifi_price: 398326, aps_bifi_price: 373330, rayzone_price: 375409, topcon585_capacity_kw: 10.53, waaree_585_price: 435756, topcon600_capacity_kw: 10.8, aps_topcon_600_price: 411602 },
  { capacity_kw: 10.45, no_of_modules: 19, inverter_capacity_kw: '10', adani_bifi_price: 416276, aps_bifi_price: 390307, rayzone_price: 392502, topcon585_capacity_kw: 11.115, waaree_585_price: 456202, topcon600_capacity_kw: 11.4, aps_topcon_600_price: 430706 }
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

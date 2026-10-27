import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const lines = fs.readFileSync('.env', 'utf8').split('\n');
const env = {};
for (const line of lines) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const supabase = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

// Official Pricing Matrix from "PRICE LIST NEW 27-08-2026-2.pdf"
// All base prices have per-kW Rs 2,000 dealer margin deducted as required
const updatedBosMatrix = [
  {
    id: 'bos-2_2',
    capacity_kw: 2.2,
    no_of_modules: 4,
    inverter_capacity_kw: '2.2KW',
    adani_bifi_price: 113482, // 117882 - (2.2 * 2000)
    aps_bifi_price: 100100,   // 104500 - (2.2 * 2000)
    rayzone_price: 100100,    // 104500 - (2.2 * 2000)
    waaree_540_price: 110296, // 114696 - (2.2 * 2000)
    topcon585_capacity_kw: 2.34,
    waaree_585_price: 121680, // 126360 - (2.34 * 2000)
    topcon600_capacity_kw: 2.4,
    aps_topcon_600_price: 112800 // 117600 - (2.4 * 2000)
  },
  {
    id: 'bos-2_75',
    capacity_kw: 2.75,
    no_of_modules: 5,
    inverter_capacity_kw: '3KW',
    adani_bifi_price: 132695, // 138195 - (2.75 * 2000)
    aps_bifi_price: 118250,   // 123750 - (2.75 * 2000)
    rayzone_price: 118250,    // 123750 - (2.75 * 2000)
    waaree_540_price: 128960, // 134460 - (2.75 * 2000)
    topcon585_capacity_kw: 2.925,
    waaree_585_price: 143325, // 149175 - (2.925 * 2000)
    topcon600_capacity_kw: 3.0,
    aps_topcon_600_price: 135600 // 141600 - (3.0 * 2000)
  },
  {
    id: 'bos-3_3',
    capacity_kw: 3.3,
    no_of_modules: 6,
    inverter_capacity_kw: '3.6KW',
    adani_bifi_price: 153573, // 160173 - (3.3 * 2000)
    aps_bifi_price: 141900,   // 148500 - (3.3 * 2000)
    rayzone_price: 141900,    // 148500 - (3.3 * 2000)
    waaree_540_price: 149244, // 155844 - (3.3 * 2000)
    topcon585_capacity_kw: 3.51,
    waaree_585_price: 166023, // 173043 - (3.51 * 2000)
    topcon600_capacity_kw: 3.6,
    aps_topcon_600_price: 157320 // 164520 - (3.6 * 2000)
  },
  {
    id: 'bos-3_85',
    capacity_kw: 3.85,
    no_of_modules: 7,
    inverter_capacity_kw: '3.6KW',
    adani_bifi_price: 178431, // 186131 - (3.85 * 2000)
    aps_bifi_price: 165550,   // 173250 - (3.85 * 2000)
    rayzone_price: 165550,    // 173250 - (3.85 * 2000)
    waaree_540_price: 173400, // 181100 - (3.85 * 2000)
    topcon585_capacity_kw: 4.095,
    waaree_585_price: 196560, // 204750 - (4.095 * 2000)
    topcon600_capacity_kw: 4.2,
    aps_topcon_600_price: 187740 // 196140 - (4.2 * 2000)
  },
  {
    id: 'bos-4_4',
    capacity_kw: 4.4,
    no_of_modules: 8,
    inverter_capacity_kw: '4/4.2KW',
    adani_bifi_price: 199880, // 208680 - (4.4 * 2000)
    aps_bifi_price: 185680,   // 194480 - (4.4 * 2000)
    rayzone_price: 185680,    // 194480 - (4.4 * 2000)
    waaree_540_price: 194240, // 203040 - (4.4 * 2000)
    topcon585_capacity_kw: 4.68,
    waaree_585_price: 219960, // 229320 - (4.68 * 2000)
    topcon600_capacity_kw: 4.8,
    aps_topcon_600_price: 214560 // 224160 - (4.8 * 2000)
  },
  {
    id: 'bos-4_95',
    capacity_kw: 4.95,
    no_of_modules: 9,
    inverter_capacity_kw: '5/5.2KW',
    adani_bifi_price: 228861, // 238761 - (4.95 * 2000)
    aps_bifi_price: 208890,   // 218790 - (4.95 * 2000)
    rayzone_price: 208890,    // 218790 - (4.95 * 2000)
    waaree_540_price: 222408, // 232308 - (4.95 * 2000)
    topcon585_capacity_kw: 5.265,
    waaree_585_price: 246402, // 256932 - (5.265 * 2000)
    topcon600_capacity_kw: 5.4,
    aps_topcon_600_price: 237600 // 248400 - (5.4 * 2000)
  },
  {
    id: 'bos-5_5',
    capacity_kw: 5.5,
    no_of_modules: 10,
    inverter_capacity_kw: '6KW',
    adani_bifi_price: 252070, // 263070 - (5.5 * 2000)
    aps_bifi_price: 232100,   // 243100 - (5.5 * 2000)
    rayzone_price: 232100,    // 243100 - (5.5 * 2000)
    waaree_540_price: 244960, // 255960 - (5.5 * 2000)
    topcon585_capacity_kw: 5.85,
    waaree_585_price: 269100, // 280800 - (5.85 * 2000)
    topcon600_capacity_kw: 6.0,
    aps_topcon_600_price: 264000 // 276000 - (6.0 * 2000)
  },
  {
    id: 'bos-6_05',
    capacity_kw: 6.05,
    no_of_modules: 11,
    inverter_capacity_kw: '6KW',
    adani_bifi_price: 274835, // 286935 - (6.05 * 2000)
    aps_bifi_price: 254100,   // 266200 - (6.05 * 2000)
    rayzone_price: 254100,    // 266200 - (6.05 * 2000)
    waaree_540_price: 267080, // 279180 - (6.05 * 2000)
    topcon585_capacity_kw: 6.435,
    waaree_585_price: 296010, // 308880 - (6.435 * 2000)
    topcon600_capacity_kw: 6.6,
    aps_topcon_600_price: 290400 // 303600 - (6.6 * 2000)
  },
  // Larger Slabs (Extended Slabs)
  {
    id: 'bos-6_6',
    capacity_kw: 6.6,
    no_of_modules: 12,
    inverter_capacity_kw: '6KW',
    adani_bifi_price: 298800,
    aps_bifi_price: 277200,
    rayzone_price: 277200,
    waaree_540_price: 291360,
    topcon585_capacity_kw: 7.02,
    waaree_585_price: 322920,
    topcon600_capacity_kw: 7.2,
    aps_topcon_600_price: 316800
  },
  {
    id: 'bos-7_7',
    capacity_kw: 7.7,
    no_of_modules: 14,
    inverter_capacity_kw: '8KW',
    adani_bifi_price: 348600,
    aps_bifi_price: 323400,
    rayzone_price: 323400,
    waaree_540_price: 339920,
    topcon585_capacity_kw: 8.19,
    waaree_585_price: 376740,
    topcon600_capacity_kw: 8.4,
    aps_topcon_600_price: 369600
  },
  {
    id: 'bos-8_25',
    capacity_kw: 8.25,
    no_of_modules: 15,
    inverter_capacity_kw: '8KW',
    adani_bifi_price: 373500,
    aps_bifi_price: 346500,
    rayzone_price: 346500,
    waaree_540_price: 364200,
    topcon585_capacity_kw: 8.775,
    waaree_585_price: 403650,
    topcon600_capacity_kw: 9.0,
    aps_topcon_600_price: 396000
  },
  {
    id: 'bos-8_8',
    capacity_kw: 8.8,
    no_of_modules: 16,
    inverter_capacity_kw: '8KW',
    adani_bifi_price: 398400,
    aps_bifi_price: 369600,
    rayzone_price: 369600,
    waaree_540_price: 388480,
    topcon585_capacity_kw: 9.36,
    waaree_585_price: 430560,
    topcon600_capacity_kw: 9.6,
    aps_topcon_600_price: 422400
  },
  {
    id: 'bos-9_35',
    capacity_kw: 9.35,
    no_of_modules: 17,
    inverter_capacity_kw: '10KW',
    adani_bifi_price: 423300,
    aps_bifi_price: 392700,
    rayzone_price: 392700,
    waaree_540_price: 412760,
    topcon585_capacity_kw: 9.945,
    waaree_585_price: 457470,
    topcon600_capacity_kw: 10.2,
    aps_topcon_600_price: 448800
  },
  {
    id: 'bos-9_9',
    capacity_kw: 9.9,
    no_of_modules: 18,
    inverter_capacity_kw: '10KW',
    adani_bifi_price: 448200,
    aps_bifi_price: 415800,
    rayzone_price: 415800,
    waaree_540_price: 437040,
    topcon585_capacity_kw: 10.53,
    waaree_585_price: 484380,
    topcon600_capacity_kw: 10.8,
    aps_topcon_600_price: 475200
  },
  {
    id: 'bos-10_45',
    capacity_kw: 10.45,
    no_of_modules: 19,
    inverter_capacity_kw: '10KW',
    adani_bifi_price: 473100,
    aps_bifi_price: 438900,
    rayzone_price: 438900,
    waaree_540_price: 461320,
    topcon585_capacity_kw: 11.115,
    waaree_585_price: 511290,
    topcon600_capacity_kw: 11.4,
    aps_topcon_600_price: 501600
  }
];

// New/missing BOM items from "BOS PRICE LIST ALL (2).pdf"
const newBomItems = [
  {
    id: 'hotdip_pipe',
    capacity_kw: 95,
    modules_spec: 'HOTDIP PIPE',
    inverter_spec: 'structure',
    dc_wire: 'Hot-Dip Galvanized Structural Pipe',
    ac_wire: 'Meter',
    earthing_wire: 'HDGI Structural Pipe',
    la_wire: '18',
    acdb: 'active',
    hardware: 'HINDUSTAN / STANDARD'
  },
  {
    id: 'pvc_clamp',
    capacity_kw: 120,
    modules_spec: 'PVC CLAMP',
    inverter_spec: 'conduits',
    dc_wire: 'PVC Conduit Pipe Heavy Clamps (100 Nos)',
    ac_wire: 'Packet',
    earthing_wire: 'UV Resistant PVC Clamps (100 Pcs/Pkt)',
    la_wire: '18',
    acdb: 'active',
    hardware: 'STANDERD'
  },
  {
    id: 'acdb_box',
    capacity_kw: 900,
    modules_spec: 'ACDB BOX (1-6 KW / 6-10 KW)',
    inverter_spec: 'electrical',
    dc_wire: 'AC Distribution Box with SPD & MCB',
    ac_wire: 'Set',
    earthing_wire: '1-Phase & 3-Phase ACDB Box IP65',
    la_wire: '18',
    acdb: 'active',
    hardware: 'POLYCAB / WINSURGE'
  },
  {
    id: 'dcdb_box',
    capacity_kw: 850,
    modules_spec: 'DCDB BOX (1-6 KW / 6-10 KW)',
    inverter_spec: 'electrical',
    dc_wire: 'DC Distribution Box with 1000V DC SPD & Fuse',
    ac_wire: 'Set',
    earthing_wire: '1 In 1 Out / 2 In 2 Out DCDB Box IP65',
    la_wire: '18',
    acdb: 'active',
    hardware: 'POLYCAB / WINSURGE'
  },
  {
    id: 'j_bolt',
    capacity_kw: 16,
    modules_spec: 'J BOLT',
    inverter_spec: 'structure',
    dc_wire: 'Galvanized Structural J-Bolt for Solar MMS',
    ac_wire: 'Nos',
    earthing_wire: 'SS 304 / HDGI Structural J-Bolt',
    la_wire: '18',
    acdb: 'active',
    hardware: 'STANDERD'
  }
];

async function updateDb() {
  console.log('1. Upserting official BOS pricing matrix...');
  for (const slab of updatedBosMatrix) {
    const { error } = await supabase.from('bos_pricing_matrix').upsert(slab, { onConflict: 'id' });
    if (error) console.error('Error saving slab', slab.id, error.message);
    else console.log('Saved slab:', slab.id, `${slab.capacity_kw} kW`);
  }

  // Remove duplicate/split rows that had 0 for other brands (e.g. bos-2_34, bos-2_4, bos-3_0, bos-3_51, etc.)
  const rowsToDelete = ['bos-2_34', 'bos-2_4', 'bos-3', 'bos-3_51', 'bos-3_6', 'bos-4_1', 'bos-4_2', 'bos-4_8', 'bos-5_4', 'bos-6'];
  console.log('Cleaning redundant split rows...');
  for (const rid of rowsToDelete) {
    await supabase.from('bos_pricing_matrix').delete().eq('id', rid);
  }

  console.log('\n2. Upserting missing BOM items from BOS PRICE LIST...');
  for (const item of newBomItems) {
    const { error } = await supabase.from('bom_catalog').upsert(item, { onConflict: 'id' });
    if (error) console.error('Error saving BOM item', item.id, error.message);
    else console.log('Saved BOM item:', item.id, item.modules_spec);
  }

  console.log('\nDatabase sync complete!');
}

updateDb().catch(console.error);

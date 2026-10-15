import { createClient } from '@supabase/supabase-js';
import { requireUser } from '../_lib/requireAuth.js';
import { getClientIp, checkDistributedRateLimit, checkRateLimit, recordFailedAttempt } from '../_lib/rateLimiter.js';
import { cacheAside, redisDel } from '../_lib/redis.js';
import { calculateSubsidy, calcBOMTotals, validateDealerMargin, calcFinalTotals } from '../../src/shared/pricing/calculations.js';
import { getSettings } from './catalog.js';
import { STANDARD_BOM_CATALOG } from '../../src/data/standardBomData.js';
import { getCorsHeaders, handleOptionsResponse } from '../_lib/cors.js';

let _env = null;
function getDb(env) {
  const e = env || _env;
  const supabaseUrl = e?.SUPABASE_URL || e?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL || process.env?.VITE_SUPABASE_URL;
  const serviceKey = e?.SUPABASE_SERVICE_ROLE_KEY || process.env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error('[FATAL] SUPABASE_URL env var is required.');
  if (!serviceKey) throw new Error('[FATAL] SUPABASE_SERVICE_ROLE_KEY env var is required.');
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

/**
 * /api/quotations — consolidated quotation resource handler
 *
 * Actions:
 *   POST   { action: 'save', ... }   → save/upsert with server-side recompute
 *   POST   { action: 'status', id, newStatus } → transition with role check
 *   GET    ?action=list              → list quotations (scoped by role with limit & offset)
 *   GET    ?action=get&id=...        → single quotation by id
 *   GET    ?action=public&token=...  → public proposal by share_token (with expiry check)
 *   DELETE { id } or ?id=...         → delete quotation (scoped by role)
 *
 * JWT required for all except 'public'.
 *
 * IMPORTANT: All financial totals are RECOMPUTED server-side.
 * Client-sent totals (base_cost, total_amount, net_payable, etc.) are IGNORED.
 * Prices are loaded from the DB using the service-role key.
 */

function parseCookies(cookieHeader = '') {
  const out = {};
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function toValidUuid(val) {
  if (!val || typeof val !== 'string') return null;
  return UUID_REGEX.test(val) ? val : null;
}



// Valid status transitions per role
const STATUS_MACHINE = {
  admin: {
    Draft: ['Pending', 'Approved', 'Rejected', 'Archived', 'Active / Sent', 'Approved / Direct'],
    Pending: ['Approved', 'Rejected', 'Archived', 'Active / Sent'],
    'Active / Sent': ['Approved', 'Rejected', 'Archived'],
    'Approved / Direct': ['Archived', 'Commissioned'],
    Approved: ['Archived', 'Commissioned'],
    Rejected: ['Archived', 'Draft'],
    Archived: []
  },
  dealer: {
    Draft: ['Pending', 'Active / Sent'],
    Pending: [],
    'Active / Sent': [],
    Approved: [],
    Rejected: ['Draft'],
    Archived: []
  },
  staff: {
    Draft: ['Pending', 'Active / Sent'],
    Pending: ['Approved', 'Rejected'],
    'Active / Sent': ['Approved', 'Rejected'],
    Approved: [],
    Rejected: [],
    Archived: []
  }
};

export function normalizeQuotationStatus(status) {
  if (!status) return 'Active / Sent';
  const s = String(status).trim();
  if (s === 'Active / Generated' || s === 'Active' || s === 'Generated' || s === 'Active / Sent') return 'Active / Sent';
  if (s === 'Approved / Direct' || s === 'Approved' || s === 'Draft' || s === 'Rejected' || s === 'Archived' || s === 'Commissioned' || s === 'Pending Inspection' || s === 'Pending') return s;
  return 'Active / Sent';
}

function canTransition(role, fromStatus, toStatus) {
  const allowed = STATUS_MACHINE[role]?.[fromStatus] || [];
  return allowed.includes(toStatus);
}

// ── BOM Catalog Map Cache ──────────────────────────────────────────────────
async function getBomCatalogMap(db) {
  const { data } = await cacheAside(_env, 'catalog:bom_map', 21600, async () => {
    const { data: rows } = await db
      .from('bom_catalog')
      .select('*');

    const map = {};

    // Standard built-in service and logistics items
    map['transportation'] = {
      id: 'transportation',
      name: 'Doorstep Freight & Logistics',
      category: 'logistics',
      rate: 1000,
      defaultRate: 1000,
      minRate: 0,
      maxRate: 50000,
      gstRate: 0
    };
    map['turnkey_installation'] = {
      id: 'turnkey_installation',
      name: 'Installation & Net-Metering Service',
      category: 'services',
      rate: 2000,
      defaultRate: 2000,
      minRate: 0,
      maxRate: 200000,
      gstRate: 18
    };

    // Seed standard catalog defaults
    if (Array.isArray(STANDARD_BOM_CATALOG)) {
      for (const item of STANDARD_BOM_CATALOG) {
        const rate = Number(item.rate ?? item.defaultRate ?? 0);
        map[item.id] = {
          id: item.id,
          name: item.name,
          category: item.category || 'structure',
          rate,
          defaultRate: rate,
          minRate: item.minRate !== undefined ? Number(item.minRate) : 0,
          maxRate: item.maxRate !== undefined ? Number(item.maxRate) : (rate > 0 ? rate * 2 : 100000),
          gstRate: Number(item.gstRate ?? 18)
        };
      }
    }

    if (Array.isArray(rows)) {
      for (const r of rows) {
        const rate = Number(r.rate ?? r.default_rate ?? r.capacity_kw ?? 0);
        const minRate = r.min_rate !== undefined && r.min_rate !== null ? Number(r.min_rate) : 0;
        const maxRate = r.max_rate !== undefined && r.max_rate !== null ? Number(r.max_rate) : (rate > 0 ? rate * 2 : 100000);
        const gstRate = Number(r.gst_rate ?? r.la_wire ?? 18);
        map[r.id] = {
          id: r.id,
          name: r.name || r.modules_spec || r.id,
          category: r.category || r.inverter_spec || 'structure',
          rate,
          defaultRate: rate,
          minRate,
          maxRate,
          gstRate
        };
      }
    }

    const ID_ALIASES = {
      anchor_fastener: 'anchor_fasner',
      anchor_fasner: 'anchor_fastener',
      fastner: 'anchor_fasner',
      fastener: 'anchor_fasner',
      la_patti: 'l_angle',
      l_angle: 'la_patti',
      ms_angels: 'l_angle',
      nut_bolts_washers: 'nutt',
      nutt: 'nut_bolts_washers',
      nut_washer: 'nutt',
      wiser: 'nutt',
      cable_ties_pack: 'cable_tye',
      cable_tye: 'cable_ties_pack',
      saddle_clips_pack: 'saddle_clip',
      saddle_clip: 'saddle_clips_pack',
      shadel_clamp: 'saddle_clip',
      dc_wire_4sqmm: 'dc_cable_red',
      dc_cable_red: 'dc_wire_4sqmm',
      dc_cable_black: 'dc_wire_4sqmm',
      ac_wire_4sqmm: 'ac_cable_red',
      ac_cable_red: 'ac_wire_4sqmm',
      ac_cable_black: 'ac_wire_4sqmm',
      la_cable_16sqmm: 'la_cable',
      la_cable: 'la_cable_16sqmm',
      earthing_wire_4sqmm: 'earthing_cable',
      earthing_cable: 'earthing_wire_4sqmm',
      pvc_conduit_pipe: 'pvc_pipe',
      pvc_pipe: 'pvc_conduit_pipe',
      pvc_pipe_25mm: 'pvc_pipe',
      pvc_elbow: 'pvc_elbow_25mm',
      pvc_elbow_25mm: 'pvc_elbow',
      pvc_tee: 'pvc_tee_25mm',
      pvc_tee_25mm: 'pvc_tee',
      mc4_connector: 'mc4_connectors',
      mc4_connectors: 'mc4_connector',
      j_bolt_40x40: 'ms_j_bolt',
      ms_j_bolt: 'j_bolt_40x40',
      stud: 'stud_12x2m',
      stud_12x2m: 'stud'
    };

    for (const [alias, target] of Object.entries(ID_ALIASES)) {
      if (map[target] && !map[alias]) {
        map[alias] = { ...map[target], id: alias };
      }
    }

    return map;
  });

  const resultMap = { ...(data || {}) };

  // Guaranteed authoritative system definitions (bypasses stale Redis/memory cache)
  resultMap['transportation'] = {
    id: 'transportation',
    name: 'Doorstep Freight & Logistics',
    category: 'logistics',
    rate: 1000,
    defaultRate: 1000,
    minRate: 0,
    maxRate: 50000,
    gstRate: 0
  };
  resultMap['turnkey_installation'] = {
    id: 'turnkey_installation',
    name: 'Installation & Net-Metering Service',
    category: 'services',
    rate: 2000,
    defaultRate: 2000,
    minRate: 0,
    maxRate: 200000,
    gstRate: 18
  };

  // Ensure all standard BOM items are also always guaranteed
  if (Array.isArray(STANDARD_BOM_CATALOG)) {
    for (const item of STANDARD_BOM_CATALOG) {
      if (!resultMap[item.id]) {
        const rate = Number(item.rate ?? item.defaultRate ?? 0);
        resultMap[item.id] = {
          id: item.id,
          name: item.name,
          category: item.category || 'structure',
          rate,
          defaultRate: rate,
          minRate: item.minRate !== undefined ? Number(item.minRate) : 0,
          maxRate: item.maxRate !== undefined ? Number(item.maxRate) : (rate > 0 ? rate * 2 : 100000),
          gstRate: Number(item.gstRate ?? 18)
        };
      }
    }
  }

  return resultMap;
}

// ── Generate server-side quotation ID (BUG-02: Strict DB Sequence) ───────────
async function generateQuotationId(db, prefix = 'SV') {
  const { data, error } = await db.rpc('next_quotation_seq');
  if (error || data === null || data === undefined) {
    throw new Error(`Failed to generate quotation sequence from database: ${error?.message || 'Empty sequence'}`);
  }
  const year = new Date().getFullYear();
  const seq = String(data).padStart(4, '0');
  return `${prefix}-${year}-Q${seq}`;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function handleSave(req, res, jwt, db) {
  const { role, dealer_id, id: userId } = jwt;
  const body = req.body || {};

  // ── Load system settings first (Database-First Single Source of Truth) ─────
  const settings = await getSettings(db, _env);
  const maxSystemKw = settings?.governance_settings?.max_system_kw ?? 1000;
  const maxDiscountPct = settings?.governance_settings?.max_discount_pct;
  const allowCustomBomLines = Boolean(settings?.governance_settings?.allow_custom_bom_lines);
  const maxCustomBomValue = Number(settings?.governance_settings?.max_custom_bom_value || 0);
  const quotePrefix = settings?.governance_settings?.quote_prefix || 'SV';
  const validityDays = Number(settings?.governance_settings?.validity_days || 15);

  // ── Input validation ───────────────────────────────────────────────────────
  const kw = Number(body.system_capacity_kw);
  if (!kw || kw <= 0 || kw > maxSystemKw) {
    return res.status(422).json({ error: `system_capacity_kw must be between 0 and ${maxSystemKw} kW.` });
  }
  if (!body.customer_name || !body.customer_phone) {
    return res.status(422).json({ error: 'customer_name and customer_phone are required.' });
  }

  // Kit quotations require panel_id
  const isKit = Boolean(body.is_kit || body.kit_id || body.project_type === 'SolarKit' || body.type === 'kit');
  if (isKit && !body.panel_id) {
    return res.status(422).json({ error: 'panel_id is required for kit quotations.' });
  }
  if (!body.panel_id && (!Array.isArray(body.bom_items) || body.bom_items.length === 0)) {
    return res.status(422).json({ error: 'panel_id or bom_items is required.' });
  }

  // ── SEC-005: IDOR Prevention & Quotation Loading ───────────────────────────
  let existingQuotation = null;
  let quotationId = body.quotation_id;
  const isEdit = body.is_edit === true;

  if (quotationId && isEdit) {
    const { data: existing, error: fetchErr } = await db
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    if (role === 'dealer') {
      if (existing.dealer_id !== dealer_id) {
        return res.status(403).json({ error: 'Access denied: You cannot modify another dealer\'s quotation.' });
      }
      if (existing.status !== 'Draft' && existing.status !== 'Rejected') {
        return res.status(409).json({
          error: `Cannot edit quotation with status "${existing.status}". Only Draft or Rejected quotations can be modified.`
        });
      }
    }

    existingQuotation = existing;
  } else if (quotationId && !isEdit) {
    // If client supplied an ID for a new quotation, check if it already exists in DB
    const { data: existing } = await db
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .maybeSingle();

    if (existing) {
      if (role === 'dealer' && existing.dealer_id !== dealer_id) {
        return res.status(403).json({ error: 'Access denied: You cannot modify another dealer\'s quotation.' });
      }
      existingQuotation = existing;
    } else {
      // New quote: clear client temporary ID so DB sequence generates official sequential ID
      quotationId = null;
    }
  }

  // T5.4 Idempotency with request_id (UUID)
  if (body.request_id && !quotationId) {
    const { data: idempExisting } = await db
      .from('quotations')
      .select('*')
      .eq('request_id', body.request_id)
      .maybeSingle();

    if (idempExisting) {
      if (role === 'dealer') {
        if (idempExisting.dealer_id !== dealer_id) {
          return res.status(403).json({ error: 'Access denied: You cannot modify another dealer\'s quotation.' });
        }
        if (idempExisting.status !== 'Draft' && idempExisting.status !== 'Rejected') {
          return res.status(409).json({
            error: `Cannot edit quotation with status "${idempExisting.status}". Only Draft or Rejected quotations can be modified.`
          });
        }
      }
      existingQuotation = idempExisting;
      quotationId = idempExisting.id;
    }
  }

  // For dealers, ignore any dealer_id in body; always enforce effectiveDealerId = jwt.dealer_id
  const effectiveDealerId = role === 'dealer' ? dealer_id : (body.dealer_id || existingQuotation?.dealer_id || null);
  const effectiveDealerCode = role === 'dealer' ? (jwt.dealerCode || body.dealer_code || existingQuotation?.dealer_code || null) : (body.dealer_code || existingQuotation?.dealer_code || null);
  const effectiveDealerName = role === 'dealer' ? (jwt.firmName || body.dealer_name || existingQuotation?.dealer_name || null) : (body.dealer_name || existingQuotation?.dealer_name || null);

  // ── Load panel price and wattage from DB (Item 3a) ─────────────────────────
  let panelRatePerWp = 0;
  let dbPanelWatt = 0;
  const rawBomItems = Array.isArray(body.bom_items) ? body.bom_items : [];
  const hasPanelItem = rawBomItems.some(i => i.id === 'solar_panel') || Boolean(body.panel_id);

  let targetPanelId = body.panel_id;
  let panelData = null;

  if (targetPanelId) {
    const { data } = await db
      .from('solar_modules')
      .select('id, brand, model, wattage, rate_per_wp_inr, rate_per_wp')
      .eq('id', targetPanelId)
      .maybeSingle();
    panelData = data;
    if (!panelData) {
      return res.status(422).json({ error: `Selected solar module "${targetPanelId}" not found in database catalog.` });
    }
  }

  // If panel_id was omitted but panel line item / module_count exists, match deterministically
  if (!panelData && hasPanelItem) {
    const expectedWatt = Number(body.panel_watt) || 0;
    const cleanBrandName = String(body.panel_type || '').toLowerCase();
    
    let query = db
      .from('solar_modules')
      .select('id, brand, model, wattage, rate_per_wp_inr, rate_per_wp');
    
    if (expectedWatt > 0) {
      query = query.eq('wattage', expectedWatt);
    }
    
    const { data: candidates } = await query;
    if (Array.isArray(candidates) && candidates.length > 0) {
      panelData = candidates.find(m => cleanBrandName && m.brand && cleanBrandName.includes(m.brand.toLowerCase()))
        || candidates[0];
      if (panelData?.id) targetPanelId = panelData.id;
    }
  }

  if (hasPanelItem && !panelData) {
    return res.status(422).json({ error: 'No matching active solar module found in database catalogue for the specified configuration.' });
  }

  if (panelData) {
    panelRatePerWp = Number(panelData.rate_per_wp_inr) || 0;
    if (!panelRatePerWp) {
      const rawStr = panelData.rate_per_wp || '';
      panelRatePerWp = Number(rawStr.replace(/[^0-9.]/g, '')) || 0;
    }
    if (!panelRatePerWp || isNaN(panelRatePerWp) || panelRatePerWp <= 0) {
      return res.status(422).json({ error: `Database rate missing for solar module "${targetPanelId}".` });
    }

    dbPanelWatt = Number(panelData.wattage) || 0;
    if (!dbPanelWatt || isNaN(dbPanelWatt) || dbPanelWatt <= 0) {
      return res.status(422).json({ error: `Database wattage missing for solar module "${targetPanelId}".` });
    }
  }

  // ── Load inverter price from DB (Item 3a) ──────────────────────────────────
  let inverterUnitPrice = 0;
  const hasInverterItem = rawBomItems.some(i => i.id === 'solar_inverter') || Boolean(body.inverter_id);
  let targetInverterId = body.inverter_id;
  let invData = null;

  if (targetInverterId) {
    const { data } = await db
      .from('solar_inverters')
      .select('id, brand, model, capacity_kw, base_price_inr, base_price')
      .eq('id', targetInverterId)
      .maybeSingle();
    invData = data;
  }

  if (!invData && hasInverterItem) {
    const { data: matchedInv } = await db
      .from('solar_inverters')
      .select('id, brand, model, capacity_kw, base_price_inr, base_price')
      .gte('capacity_kw', kw * 0.9)
      .order('capacity_kw', { ascending: true })
      .limit(1)
      .maybeSingle();
    invData = matchedInv;
    if (invData?.id) targetInverterId = invData.id;
  }

  if (!invData && hasInverterItem) {
    const { data: defaultInv } = await db
      .from('solar_inverters')
      .select('id, brand, model, capacity_kw, base_price_inr, base_price')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    invData = defaultInv;
    if (invData?.id) targetInverterId = invData.id;
  }

  if (hasInverterItem && !invData) {
    return res.status(422).json({ error: 'No active solar inverters found in database catalogue.' });
  }

  if (invData) {
    inverterUnitPrice = Number(invData.base_price_inr) || 0;
    if (!inverterUnitPrice) {
      const rawStr = invData.base_price || '';
      inverterUnitPrice = Number(rawStr.replace(/[^0-9.]/g, '')) || 0;
    }
    if (!inverterUnitPrice || isNaN(inverterUnitPrice) || inverterUnitPrice <= 0) {
      return res.status(422).json({ error: `Database price missing for solar inverter "${targetInverterId}".` });
    }
  }

  // ── Capacity validation against panel quantity * DB wattage (Item 3b) ───────
  const panelBomItem = rawBomItems.find(i => i.id === 'solar_panel');
  const panelQty = panelBomItem ? Math.min(10000, Math.max(0, Number(panelBomItem.qty) || 0)) : (Number(body.module_count) || 0);

  let serverValidatedKw = kw;
  if (dbPanelWatt > 0 && panelQty > 0) {
    const calculatedKw = (panelQty * dbPanelWatt) / 1000;
    const tolerance = 0.15; // 0.15 kW tolerance
    if (Math.abs(kw - calculatedKw) > tolerance) {
      return res.status(422).json({
        error: `system_capacity_kw (${kw} kW) does not match panel quantity and database wattage (${panelQty} x ${dbPanelWatt}W = ${calculatedKw.toFixed(2)} kW).`
      });
    }
    serverValidatedKw = Number(calculatedKw.toFixed(2));
  }

  // ── Load dealer margin cap strictly from DB (HC-03 / HC-04: Database-First) ──
  let maxMarginCapPerKw = null;
  let cachedDealer = null;
  const isDirectCompany = body.is_direct_company_quote === true || effectiveDealerId === 'SV-DIRECT' || effectiveDealerCode === 'SV-DIRECT';
  const effectiveDealerIdentifier = effectiveDealerId || effectiveDealerCode;

  if (effectiveDealerIdentifier && effectiveDealerIdentifier !== 'SV-DIRECT' && !isDirectCompany) {
    const { data: dData } = await cacheAside(_env, `dealer:rates:${effectiveDealerIdentifier}`, 43200, async () => {
      let q = db
        .from('dealer_accounts')
        .select('id, dealer_code, firm_name, max_margin_cap_per_kw, tier');

      if (toValidUuid(effectiveDealerIdentifier)) {
        q = q.or(`id.eq.${effectiveDealerIdentifier},dealer_code.eq.${effectiveDealerIdentifier}`);
      } else {
        q = q.eq('dealer_code', effectiveDealerIdentifier);
      }

      const { data: dealerData } = await q.maybeSingle();
      return dealerData || null;
    });
    cachedDealer = dData;

    if (cachedDealer?.max_margin_cap_per_kw != null && !isNaN(Number(cachedDealer.max_margin_cap_per_kw))) {
      maxMarginCapPerKw = Number(cachedDealer.max_margin_cap_per_kw);
    } else if (cachedDealer?.tier) {
      const tierClean = String(cachedDealer.tier).toLowerCase();
      const tierId = tierClean.includes('diamond') ? 'diamond' :
                     tierClean.includes('platinum') ? 'platinum' :
                     tierClean.includes('silver') ? 'silver' : 'gold';
      const { data: tierData } = await db
        .from('dealer_custom_pricing')
        .select('max_margin_cap_per_kw')
        .eq('tier_id', tierId)
        .maybeSingle();
      if (tierData?.max_margin_cap_per_kw != null && !isNaN(Number(tierData.max_margin_cap_per_kw))) {
        maxMarginCapPerKw = Number(tierData.max_margin_cap_per_kw);
      }
    }
  }

  if (maxMarginCapPerKw === null || isNaN(maxMarginCapPerKw)) {
    const { data: defaultTier } = await db
      .from('dealer_custom_pricing')
      .select('max_margin_cap_per_kw')
      .eq('tier_id', 'silver')
      .maybeSingle();
    if (defaultTier?.max_margin_cap_per_kw != null && !isNaN(Number(defaultTier.max_margin_cap_per_kw))) {
      maxMarginCapPerKw = Number(defaultTier.max_margin_cap_per_kw);
    }
  }

  if (maxMarginCapPerKw === null || isNaN(maxMarginCapPerKw)) {
    const { data: anyTier } = await db
      .from('dealer_custom_pricing')
      .select('max_margin_cap_per_kw')
      .limit(1)
      .maybeSingle();
    if (anyTier?.max_margin_cap_per_kw != null && !isNaN(Number(anyTier.max_margin_cap_per_kw))) {
      maxMarginCapPerKw = Number(anyTier.max_margin_cap_per_kw);
    }
  }

  if (maxMarginCapPerKw === null || isNaN(maxMarginCapPerKw)) {
    maxMarginCapPerKw = 6000;
  }

  // ── SEC-006: Server-side price EVERY BOM line item from bom_catalog (Item 3c) ────────
  const bomCatalogMap = await getBomCatalogMap(db);
  const tolerancePct = settings?.governance_settings?.bom_rate_tolerance_pct !== undefined
    ? Number(settings.governance_settings.bom_rate_tolerance_pct)
    : 10;

  const sanitizedBom = [];
  for (const item of rawBomItems) {
    if (item.id === 'solar_panel') {
      const qty = Math.min(10000, Math.max(0, Number(item.qty) || 0));
      const rate = Math.round(dbPanelWatt * panelRatePerWp);
      sanitizedBom.push({ ...item, qty, rate, gstRate: 5 });
      continue;
    }
    if (item.id === 'solar_inverter') {
      const qty = Math.min(10000, Math.max(0, Number(item.qty) || 0));
      const rate = inverterUnitPrice;
      sanitizedBom.push({ ...item, qty, rate, gstRate: 5 });
      continue;
    }
    if (item.id === 'transportation') {
      // Authoritative Transportation calculation:
      // Presets: dealer_scope -> ₹0, rajkot_local -> ₹1,000, custom -> authorized custom transport charge (clamped to maxCustomBomValue or 50,000)
      const quotePayloadObj = (typeof body.quote_payload === 'object' && body.quote_payload !== null) ? body.quote_payload : {};
      const transportPreset = String(body.transport_preset || quotePayloadObj.transportPreset || (Number(body.transport_charge ?? quotePayloadObj.transportCharge) === 0 ? 'dealer_scope' : 'rajkot_local')).toLowerCase();
      
      let authTransportRate = 1000;
      if (transportPreset === 'dealer_scope') {
        authTransportRate = 0;
      } else if (transportPreset === 'rajkot_local') {
        authTransportRate = 1000;
      } else if (transportPreset === 'custom') {
        const ceiling = maxCustomBomValue > 0 ? maxCustomBomValue : 50000;
        const requestedCharge = Number(body.transport_charge !== undefined ? body.transport_charge : (quotePayloadObj.transportCharge !== undefined ? quotePayloadObj.transportCharge : item.rate));
        authTransportRate = Math.min(ceiling, Math.max(0, isNaN(requestedCharge) ? 1000 : requestedCharge));
      } else {
        authTransportRate = 1000;
      }

      sanitizedBom.push({
        ...item,
        name: authTransportRate > 0 ? 'Doorstep Freight & Safe Logistics' : 'Doorstep Freight (Dealer / Client Scope)',
        category: 'logistics',
        unit: 'LOT',
        qty: 1,
        rate: authTransportRate,
        gstRate: 0
      });
      continue;
    }
    if (item.id === 'turnkey_installation') {
      // Authoritative Turnkey Installation calculation:
      // Uses verified serverValidatedKw and trusted structure-specific rates:
      // - standard_hdgi: ₹2,000/kW
      // - monorail: ₹1,400/kW
      // - hybrid: weighted (1 - monoFrac) * 2000 + monoFrac * 1400
      const quotePayloadObj = (typeof body.quote_payload === 'object' && body.quote_payload !== null) ? body.quote_payload : {};
      const structType = String(body.structure_type || quotePayloadObj.structureType || 'standard_hdgi').toLowerCase();
      
      let trustedRatePerKw = 2000;
      if (structType.includes('monorail') && !structType.includes('hybrid')) {
        trustedRatePerKw = 1400;
      } else if (structType.includes('hybrid')) {
        const monoPct = Number(body.hybrid_monorail_percent || quotePayloadObj.hybridMonorailPercent || 50);
        const monoFrac = Math.max(0.1, Math.min(0.9, monoPct / 100));
        trustedRatePerKw = Math.round((1 - monoFrac) * 2000 + monoFrac * 1400);
      } else {
        trustedRatePerKw = 2000;
      }

      const installPricingMode = String(body.installation_pricing_mode || quotePayloadObj.installationPricingMode || 'per_kw').toLowerCase();
      let authInstallRate = 0;

      if (installPricingMode === 'fixed' || installPricingMode === 'amount') {
        const fixedAmt = Number(body.installation_fixed_amount !== undefined ? body.installation_fixed_amount : quotePayloadObj.installationFixedAmount);
        authInstallRate = Math.min(200000, Math.max(0, (!isNaN(fixedAmt) && fixedAmt > 0) ? fixedAmt : Math.round(serverValidatedKw * trustedRatePerKw)));
      } else {
        // Mode 'per_kw': client rate is strictly ignored, recomputed from serverValidatedKw * trustedRatePerKw
        authInstallRate = Math.round(serverValidatedKw * trustedRatePerKw);
      }

      sanitizedBom.push({
        ...item,
        name: `Turnkey Installation & Net-Metering Service (${serverValidatedKw} kW @ ₹${trustedRatePerKw}/kW)`,
        category: 'services',
        unit: 'JOB',
        qty: 1,
        rate: authInstallRate,
        gstRate: 18
      });
      continue;
    }

    const catEntry = bomCatalogMap[item.id];
    if (!catEntry) {
      if (!allowCustomBomLines) {
        return res.status(422).json({ error: `Unknown BOM item ID: "${item.id}". Custom BOM line items are not permitted.` });
      }
      const qty = Math.min(10000, Math.max(0, Number(item.qty) || 0));
      let rate = Math.max(0, Number(item.rate) || 0);
      if (maxCustomBomValue > 0 && rate > maxCustomBomValue) {
        rate = maxCustomBomValue;
      }
      const validSlabs = settings?.statutory_taxes?.gstSlabs || [0, 5, 12, 18, 28];
      const gstRate = validSlabs.includes(Number(item.gstRate)) ? Number(item.gstRate) : 18;
      sanitizedBom.push({ ...item, qty, rate, gstRate });
      continue;
    }

    const qty = Math.min(10000, Math.max(0, Number(item.qty) || 0));
    const defaultRate = Number(catEntry.defaultRate) || 0;
    const minAllowedRate = defaultRate > 0 ? Math.round((1 - tolerancePct / 100) * defaultRate) : 0;
    const maxAllowedRate = defaultRate > 0 ? Math.round((1 + tolerancePct / 100) * defaultRate) : (catEntry.maxRate || 100000);

    let rate = Number(item.rate);
    if (isNaN(rate) || rate <= 0) {
      rate = defaultRate;
    } else {
      rate = Math.min(maxAllowedRate, Math.max(minAllowedRate, rate));
    }

    // GST rate strictly from catalogue row, not client
    const gstRate = catEntry.gstRate;
    sanitizedBom.push({
      ...item,
      name: catEntry.name || item.name,
      category: catEntry.category || item.category,
      qty,
      rate,
      gstRate
    });
  }

  // ── Regional settings & Yield Resolution ──────────────────────────────────
  const supplierState = String(body.supplier_state || settings?.company_profile?.state || 'Gujarat').trim();
  const defaultYield = Number(settings?.governance_settings?.default_specific_yield || settings?.governance_settings?.defaultSpecificYield || 4.2);
  const peakSunHours = Number(body.peak_sun_hours) || defaultYield || 4.2;

  const isInterState = String(body.customer_state || supplierState).trim().toLowerCase() !== supplierState.trim().toLowerCase();
  const bomTotals = calcBOMTotals(sanitizedBom, isInterState, settings?.statutory_taxes?.gstSlabs);

  // Margin validation and capping uses server-validated kW (Item 3b)
  const clientMargin = Number(body.dealer_margin_inr) || 0;
  const { effectiveMargin, isMarginExceeded } = validateDealerMargin(
    isDirectCompany ? 0 : clientMargin,
    serverValidatedKw,
    maxMarginCapPerKw
  );

  // PM Surya Ghar Subsidy uses server-validated kW
  const subsidyAmount = calculateSubsidy(serverValidatedKw, body.project_type || 'Residential', settings);

  // Discount validation: fail-closed clamping to governance_settings.max_discount_pct
  const allowedDiscountPct = (maxDiscountPct !== undefined && maxDiscountPct !== null && typeof maxDiscountPct === 'number')
    ? maxDiscountPct
    : 0;
  const maxDiscountAmount = Math.round(bomTotals.grossTurnkeyCost * (allowedDiscountPct / 100));
  const requestedDiscount = Math.max(0, Number(body.discount_amount) || 0);
  const clampedDiscount = Math.min(requestedDiscount, maxDiscountAmount);

  const { totalAmount, netPayable } = calcFinalTotals({
    grossTurnkeyCost: bomTotals.grossTurnkeyCost,
    dealerMarginINR: effectiveMargin,
    discountAmount: clampedDiscount,
    subsidyAmount
  });

  // ── Extract client UI / presentation metadata (F-01: Downstream Field Preservation) ──
  const clientPayload = (typeof body.quote_payload === 'object' && body.quote_payload !== null) ? body.quote_payload : {};
  
  // ── Authoritative Server-side Energy & Savings Recompute (Anti-Tampering) ────
  const defaultTariff = Number(settings?.governance_settings?.default_tariff || 6.5);
  const resolvedTariff = (Number(body.tariff ?? clientPayload.tariff) > 0) ? Number(body.tariff ?? clientPayload.tariff) : defaultTariff;
  const serverAnnualGenUnits = Math.round(serverValidatedKw * (peakSunHours > 100 ? peakSunHours : (peakSunHours > 0 ? Math.round(peakSunHours * 365) : 1440)));
  const serverMonthlyGenUnits = Math.round(serverAnnualGenUnits / 12);
  const serverAnnualSavings = Math.round(serverAnnualGenUnits * resolvedTariff);
  const serverMonthlySavings = Math.round(serverAnnualSavings / 12);
  const serverPaybackYears = serverAnnualSavings > 0 ? (netPayable / serverAnnualSavings).toFixed(1) : '3.6';

  // ── Build frozen quote_payload (Preserves UI metadata; forces authoritative server money & telemetry) ──
  const quotePayload = {
    // Authoritative server-computed energy & financial telemetry (cannot be client-spoofed)
    annualGenerationUnits: serverAnnualGenUnits,
    monthlyGenerationUnits: serverMonthlyGenUnits,
    annualSavings: serverAnnualSavings,
    monthlySavings: serverMonthlySavings,
    paybackYears: serverPaybackYears,
    tariff: resolvedTariff,
    specificYield: peakSunHours,
    roofConfig: clientPayload.roofConfig || body.roof_config || null,
    coverImage: clientPayload.coverImage || clientPayload.customCoverUrl || body.custom_cover_url || null,
    customCoverUrl: clientPayload.customCoverUrl || clientPayload.coverImage || body.custom_cover_url || null,
    estimatedMonthlyEmi: clientPayload.estimatedMonthlyEmi || body.estimated_monthly_emi || null,
    paymentMode: body.payment_mode || clientPayload.paymentMode || body.finance_type || 'CASH',
    quoteChannel: clientPayload.quoteChannel || (isDirectCompany ? 'direct' : 'dealer'),
    creatorRole: clientPayload.creatorRole || role,
    creatorStaffId: clientPayload.creatorStaffId || null,
    creatorStaffName: clientPayload.creatorStaffName || null,
    pricingMode: clientPayload.pricingMode || null,
    pricingCategory: clientPayload.pricingCategory || null,
    transportPreset: clientPayload.transportPreset || body.transport_preset || null,
    transportCharge: Number(clientPayload.transportCharge ?? body.transport_charge ?? 1000),
    installationPricingMode: clientPayload.installationPricingMode || body.installation_pricing_mode || 'per_kw',
    installationFixedAmount: Number(clientPayload.installationFixedAmount ?? body.installation_fixed_amount ?? 0),
    installationRatePerKw: Number(clientPayload.installationRatePerKw ?? body.installation_rate_per_kw ?? 2000),
    moduleCount: Number(body.module_count ?? clientPayload.moduleCount ?? panelQty),
    panelWatt: Number(body.panel_watt ?? clientPayload.panelWatt ?? dbPanelWatt),
    moduleEstimatedCost: Number(clientPayload.moduleEstimatedCost ?? 0),
    inverterEstimatedCost: Number(clientPayload.inverterEstimatedCost ?? 0),
    structureEstimatedCost: Number(clientPayload.structureEstimatedCost ?? 0),
    bosEstimatedCost: Number(clientPayload.bosEstimatedCost ?? 0),
    selectedModuleMake: clientPayload.selectedModuleMake || null,
    selectedInverterMake: clientPayload.selectedInverterMake || null,
    multiBrandComparison: Boolean(clientPayload.multiBrandComparison),
    multiBrandPackages: Array.isArray(clientPayload.multiBrandPackages) ? clientPayload.multiBrandPackages : null,

    // Authoritative server-calculated BOM and Financial totals (cannot be spoofed)
    bomItems: bomTotals.calculatedItems,
    bomTotals: {
      subtotal0Base: bomTotals.subtotal0Base,
      subtotal5Base: bomTotals.subtotal5Base,
      subtotal12Base: bomTotals.subtotal12Base,
      subtotal18Base: bomTotals.subtotal18Base,
      subtotal28Base: bomTotals.subtotal28Base,
      gst5Total: bomTotals.gst5Total,
      gst12Total: bomTotals.gst12Total,
      gst18Total: bomTotals.gst18Total,
      gst28Total: bomTotals.gst28Total,
      cgstTotal: bomTotals.cgstTotal,
      sgstTotal: bomTotals.sgstTotal,
      igstTotal: bomTotals.igstTotal,
      grossTurnkeyCost: bomTotals.grossTurnkeyCost
    },
    panelId: body.panel_id,
    inverterId: body.inverter_id,
    panelRatePerWp,
    inverterUnitPrice,
    baseCost: bomTotals.grossTurnkeyCost,
    totalAmount,
    grandTotalCustomer: totalAmount,
    subsidyAmount,
    netPayable,
    dealerMargin: effectiveMargin,
    dealerMarginPerKw: kw > 0 ? Math.round(effectiveMargin / kw) : 0,
    marginExceededAndCapped: isMarginExceeded,
    discountAmount: clampedDiscount,
    projectType: body.project_type || 'Residential',
    financeType: body.finance_type || 'CASH',
    loanBank: body.loan_bank || null,
    loanTenureYears: Number(body.loan_tenure_years) || 5,
    isDirectCompanyQuote: isDirectCompany,
    isInterState,
    companyProfile: settings?.company_profile || null,
    computedAt: new Date().toISOString(),
    serverVersion: '2.2'
  };

  // ── Generate or reuse quotation ID ─────────────────────────────────────────
  const isNew = !quotationId;
  if (isNew) {
    try {
      quotationId = await generateQuotationId(db, quotePrefix);
    } catch (seqErr) {
      console.error('[generateQuotationId error]', seqErr.message);
      return res.status(500).json({ error: 'Failed to generate quotation ID sequence from database.' });
    }
  }

  const shareExpiresAt = existingQuotation?.share_expires_at ||
    new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

  // Generate or preserve unguessable public share token (18 bytes hex = 36 hex chars)
  const shareToken = existingQuotation?.share_token || body.share_token || body.quote_payload?.shareToken || body.quote_payload?.share_token || randomBytes(18).toString('hex');

  const statusToSave = normalizeQuotationStatus(body.status || (isNew ? (isDirectCompany ? 'Approved / Direct' : 'Active / Sent') : (existingQuotation?.status || 'Active / Sent')));

  const rawDealerUuid = cachedDealer?.id || (toValidUuid(effectiveDealerId) ? effectiveDealerId : null);
  const resolvedDealerUuid = toValidUuid(rawDealerUuid);

  let rawDealerCode = cachedDealer?.dealer_code || effectiveDealerCode;
  if (!rawDealerCode && !resolvedDealerUuid) {
    rawDealerCode = (effectiveDealerId && !toValidUuid(effectiveDealerId)) ? effectiveDealerId : null;
  }
  if (!rawDealerCode && isDirectCompany) {
    rawDealerCode = 'SV-DIRECT';
  }

  // Ensure resolvedDealerCode is a string, clamped to max 50 chars, and never a UUID
  let resolvedDealerCode = null;
  if (rawDealerCode && typeof rawDealerCode === 'string') {
    const trimmed = rawDealerCode.trim();
    if (!UUID_REGEX.test(trimmed)) {
      resolvedDealerCode = trimmed.slice(0, 50);
    }
  }

  const resolvedDealerName = cachedDealer?.firm_name || effectiveDealerName || (isDirectCompany ? 'Sunvine Renewable Energy (Head Office)' : null);

  const record = {
    id: quotationId,
    dealer_id: resolvedDealerUuid,
    dealer_code: resolvedDealerCode,
    dealer_name: resolvedDealerName ? String(resolvedDealerName).trim().slice(0, 255) : null,
    customer_name: String(body.customer_name).trim().slice(0, 255),
    customer_phone: String(body.customer_phone).trim().slice(0, 20),
    customer_city: body.customer_city ? String(body.customer_city).trim().slice(0, 255) : null,
    customer_state: body.customer_state ? String(body.customer_state).trim().slice(0, 255) : supplierState,
    system_capacity_kw: serverValidatedKw,
    panel_type: body.panel_type ? String(body.panel_type).trim().slice(0, 255) : null,
    inverter_type: body.inverter_type ? String(body.inverter_type).trim().slice(0, 255) : null,
    structure_type: body.structure_type ? String(body.structure_type).trim().slice(0, 255) : null,
    // Server-computed financial fields (client values IGNORED)
    base_cost: bomTotals.grossTurnkeyCost,
    dealer_margin: effectiveMargin,
    total_amount: totalAmount,
    subsidy_amount: subsidyAmount,
    net_payable: netPayable,
    annual_generation_kwh: Math.round(serverValidatedKw * (peakSunHours > 100 ? peakSunHours : (peakSunHours > 0 ? Math.round(peakSunHours * 365) : 1440))),
    status: String(statusToSave).trim().slice(0, 50),
    request_id: toValidUuid(body.request_id),
    share_token: shareToken,
    share_expires_at: shareExpiresAt,
    quote_payload: {
      ...quotePayload,
      id: quotationId,
      status: statusToSave,
      shareToken: shareToken,
      share_token: shareToken,
      dealerId: resolvedDealerCode || resolvedDealerUuid,
      dealerCode: resolvedDealerCode,
      dealerName: resolvedDealerName
    },
    updated_at: new Date().toISOString()
  };

  // Remove undefined fields
  Object.keys(record).forEach(k => record[k] === undefined && delete record[k]);

  const { data, error } = await db.from('quotations').upsert([record], {
    onConflict: 'id',
    ignoreDuplicates: false
  }).select().single();

  if (error) {
    console.error('[api/quotations save]', error.message);
    return res.status(500).json({ error: 'Failed to save quotation. Please try again.' });
  }

  // Invalidate public proposal cache on save
  if (data?.share_token || body?.share_token) {
    await redisDel(_env, `quote:public:${data?.share_token || body?.share_token}`).catch(() => {});
  }

  // ── SEC-019 & BUG-01: Audit log entry in audit_logs table ───────────────────
  try {
    const { error: auditErr } = await db.from('audit_logs').insert([{
      actor_id: String(userId || resolvedDealerUuid || resolvedDealerCode || 'system').slice(0, 100),
      actor_role: String(role || 'unknown').slice(0, 100),
      action: isNew ? 'quotation_created' : 'quotation_updated',
      entity_type: 'quotation',
      entity_id: String(quotationId).slice(0, 100),
      details: {
        kw,
        totalAmount,
        netPayable,
        subsidyAmount,
        discountAmount: clampedDiscount,
        effectiveMargin,
        isMarginExceeded
      }
    }]);
    if (auditErr) {
      console.error('[audit_log insert failed]', auditErr.message);
    }
  } catch (auditException) {
    console.error('[audit_log insert exception]', auditException.message);
  }

  return res.status(200).json({
    success: true,
    id: data?.id,
    quotation: {
      ...data,
      share_token: data?.share_token || shareToken,
      shareToken: data?.share_token || shareToken,
      _marginExceededAndCapped: isMarginExceeded,
      _clampedDiscount: clampedDiscount
    }
  });
}

export async function handleStatus(req, res, jwt, db) {
  const { role, dealer_id } = jwt;
  const { id, newStatus } = req.body || {};

  if (!id || !newStatus) return res.status(400).json({ error: 'id and newStatus are required.' });

  // Fetch current status and share_token
  const { data: existing, error: fetchErr } = await db
    .from('quotations')
    .select('id, status, dealer_id, share_token')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !existing) return res.status(404).json({ error: 'Quotation not found.' });

  // Ownership check for dealers
  if (role === 'dealer' && existing.dealer_id !== dealer_id) {
    return res.status(403).json({ error: 'You can only update your own quotations.' });
  }

  if (!canTransition(role, existing.status, newStatus)) {
    return res.status(422).json({
      error: `Cannot transition from "${existing.status}" to "${newStatus}" as ${role}.`,
      allowedTransitions: STATUS_MACHINE[role]?.[existing.status] || []
    });
  }

  const { error: updateErr } = await db
    .from('quotations')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateErr) return res.status(500).json({ error: 'Status update failed.' });

  // Invalidate public quotation cache
  if (existing.share_token) {
    await redisDel(_env, `quote:public:${existing.share_token}`).catch(() => {});
  }

  // ── SEC-019 & BUG-01: Audit log entry in audit_logs table ───────────────────
  try {
    const { error: auditErr } = await db.from('audit_logs').insert([{
      actor_id: jwt.id || dealer_id || null,
      actor_role: role || 'unknown',
      action: 'status_changed',
      entity_type: 'quotation',
      entity_id: id,
      details: { from: existing.status, to: newStatus }
    }]);
    if (auditErr) {
      console.error('[audit_log insert failed]', auditErr.message);
    }
  } catch (auditException) {
    console.error('[audit_log insert exception]', auditException.message);
  }

  return res.status(200).json({ success: true, id, status: newStatus });
}

// ── T5.5: Public view with share token expiry check ─────────────────────────
export async function handlePublicView(req, res, db) {
  const { token } = req.query || {};
  if (!token) return res.status(400).json({ error: 'share_token is required.' });

  const clientIp = getClientIp(req);
  // Distributed Rate Limit for public links: 30 requests/minute per IP
  const rateCheck = await checkDistributedRateLimit(`pub:${clientIp}`, { maxAttempts: 30, windowMs: 60 * 1000 });
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: `Too many requests. Try again in ${rateCheck.resetSeconds}s.` });
  }

  // Cache-Aside with 7-day sliding safety TTL
  const { data, fromCache } = await cacheAside(_env, `quote:public:v2:${token}`, 604800, async () => {
    const { data: quoteData } = await db
      .from('quotations')
      .select('id, customer_name, customer_phone, customer_city, customer_state, system_capacity_kw, panel_type, inverter_type, structure_type, total_amount, subsidy_amount, net_payable, annual_generation_kwh, status, share_token, quote_payload, share_expires_at, created_at')
      .eq('share_token', token)
      .neq('status', 'Archived')
      .maybeSingle();

    if (!quoteData) return null;

    const isExpired = quoteData.share_expires_at && new Date(quoteData.share_expires_at).getTime() < Date.now();

    const payload = (typeof quoteData.quote_payload === 'string')
      ? JSON.parse(quoteData.quote_payload)
      : (quoteData.quote_payload || {});

    // Resolve company profile from payload or active database settings
    let companyProfile = payload.companyProfile || payload.company_profile;
    const hasGstin = Boolean(companyProfile?.gstin && String(companyProfile.gstin).trim());
    const bankAcc = companyProfile?.bank?.accountNumber || companyProfile?.bank?.account_number || companyProfile?.bankDetails?.accountNumber || companyProfile?.bankDetails?.account_number;
    const hasBank = Boolean(bankAcc && String(bankAcc).trim());

    if (!hasGstin || !hasBank) {
      const settings = await getSettings(db, _env);
      if (settings?.company_profile) {
        companyProfile = {
          ...settings.company_profile,
          ...(companyProfile || {}),
          bank: {
            ...(settings.company_profile?.bank || {}),
            ...(companyProfile?.bank || companyProfile?.bankDetails || {})
          }
        };
      }
    }

    return {
      id: quoteData.id,
      shareToken: quoteData.share_token || token,
      share_token: quoteData.share_token || token,
      customerName: quoteData.customer_name || payload.customerName || 'Valued Customer',
      customerPhone: quoteData.customer_phone || payload.customerPhone || '',
      city: quoteData.customer_city || payload.city || payload.customerCity || 'Rajkot',
      state: quoteData.customer_state || payload.state || payload.customerState || 'Gujarat',
      location: payload.location || (quoteData.customer_city ? `${quoteData.customer_city}, ${quoteData.customer_state || 'Gujarat'}` : 'Gujarat, India'),
      systemCapacityKw: Number(quoteData.system_capacity_kw ?? payload.systemCapacityKW ?? payload.capacityKW ?? 0),
      systemCapacityKW: Number(quoteData.system_capacity_kw ?? payload.systemCapacityKW ?? payload.capacityKW ?? 0),
      capacityKW: Number(quoteData.system_capacity_kw ?? payload.systemCapacityKW ?? payload.capacityKW ?? 0),
      capacity: Number(quoteData.system_capacity_kw ?? payload.systemCapacityKW ?? payload.capacityKW ?? 0),
      panelType: quoteData.panel_type || payload.panelType || payload.solarModule || '',
      solarModule: payload.solarModule || quoteData.panel_type || '',
      moduleWattage: Number(payload.moduleWattage || payload.panelWatt) || 585,
      moduleCount: Number(payload.moduleCount || payload.panelQuantity) || 0,
      pvModuleSize: payload.pvModuleSize || '2278 × 1134 × 30 mm',
      inverterType: quoteData.inverter_type || payload.inverterType || '',
      inverterCapacity: payload.inverterCapacity || `${Number(quoteData.system_capacity_kw ?? payload.systemCapacityKW ?? 0)} kW`,
      inverterCount: payload.inverterCount || '1 NOS',
      structureType: quoteData.structure_type || payload.structureType || '',
      totalAmount: Number(quoteData.total_amount ?? payload.totalAmount ?? payload.grandTotalCustomer ?? 0),
      grandTotalCustomer: Number(quoteData.total_amount ?? payload.totalAmount ?? payload.grandTotalCustomer ?? 0),
      subsidyAmount: Number(quoteData.subsidy_amount ?? payload.subsidyAmount ?? 0),
      netPayable: Number(quoteData.net_payable ?? payload.netPayable ?? 0),
      annualGenerationKwh: Number(quoteData.annual_generation_kwh ?? payload.annualGenerationKwh ?? payload.annualGeneration ?? 0),
      annual_generation_kwh: Number(quoteData.annual_generation_kwh ?? payload.annualGenerationKwh ?? payload.annualGeneration ?? 0),
      annualGenerationUnits: Number(payload.annualGenerationUnits || quoteData.annual_generation_kwh || (Number(quoteData.system_capacity_kw || 0) * 1440)),
      annualSavings: Number(payload.annualSavings || Math.round((Number(payload.annualGenerationUnits || quoteData.annual_generation_kwh || (Number(quoteData.system_capacity_kw || 0) * 1440))) * Number(payload.tariff || 6.5))),
      paybackYears: String(payload.paybackYears || (Number(payload.annualSavings) > 0 ? (Number(quoteData.net_payable) / Number(payload.annualSavings)).toFixed(1) : '3.6')),
      tariff: Number(payload.tariff || 6.5),
      specificYield: Number(payload.specificYield || 4.2),
      status: quoteData.status,
      shareExpiresAt: quoteData.share_expires_at,
      isExpired,
      bomItems: payload.bomItems || [],
      bomTotals: payload.bomTotals || {},
      companyProfile: companyProfile || null,
      projectType: payload.projectType || 'Residential',
      multiBrandComparison: Boolean(payload.multiBrandComparison),
      multiBrandPackages: payload.multiBrandPackages || null,
      selectedModuleMake: payload.selectedModuleMake || '',
      selectedInverterMake: payload.selectedInverterMake || '',
      dealerName: payload.dealerName || 'Sunvine Renewable Energy',
      dealerCode: payload.dealerCode || 'SV-DIRECT',
      isDirectCompanyQuote: payload.isDirectCompanyQuote ?? true,
      customCoverUrl: payload.customCoverUrl || null,
      coverImage: payload.coverImage || null,
      date: payload.date || (quoteData.created_at ? new Date(quoteData.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')),
      createdAt: quoteData.created_at
    };
  });

  if (!data) return res.status(404).json({ error: 'Proposal not found.' });

  // Expiration check (fail closed with 410 Gone)
  if (data.isExpired || (data.shareExpiresAt && new Date(data.shareExpiresAt).getTime() < Date.now())) {
    return res.status(410).json({ error: 'Proposal share link has expired.' });
  }

  res.setHeader('X-Cache-Source', fromCache ? 'Redis' : 'Database');
  return res.status(200).json({
    success: true,
    quotation: data
  });
}

// ── T5.5: List with pagination & role column scoping ─────────────────────────
export async function handleList(req, res, jwt, db) {
  const { role, dealer_id } = jwt;
  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);

  // Column projection: dealers do not receive internal staff financial margins
  const selectColumns = role === 'dealer'
    ? 'id, dealer_id, dealer_code, dealer_name, customer_name, customer_phone, customer_city, customer_state, system_capacity_kw, panel_type, inverter_type, structure_type, total_amount, subsidy_amount, net_payable, annual_generation_kwh, status, share_token, request_id, share_expires_at, quote_payload, created_at, updated_at'
    : 'id, dealer_id, dealer_code, dealer_name, customer_name, customer_phone, customer_city, customer_state, system_capacity_kw, panel_type, inverter_type, structure_type, base_cost, dealer_margin, total_amount, subsidy_amount, net_payable, annual_generation_kwh, status, share_token, request_id, share_expires_at, quote_payload, created_at, updated_at';

  let query = db
    .from('quotations')
    .select(selectColumns, { count: 'exact' });

  if (role === 'dealer') {
    const isDealerUuid = toValidUuid(dealer_id);
    const code = jwt.dealerCode || (isDealerUuid ? null : dealer_id);
    if (isDealerUuid && code && code !== dealer_id) {
      query = query.or(`dealer_id.eq.${dealer_id},dealer_code.eq.${code}`);
    } else if (isDealerUuid) {
      query = query.eq('dealer_id', dealer_id);
    } else if (code) {
      query = query.eq('dealer_code', code);
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[api/quotations list]', error.message);
    return res.status(500).json({ error: 'Failed to fetch quotations.' });
  }

  return res.status(200).json({ success: true, quotations: data || [], total: count, limit, offset });
}

export async function handleGet(req, res, jwt, db) {
  const { role, dealer_id } = jwt;
  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'id parameter is required.' });

  const selectColumns = role === 'dealer'
    ? 'id, dealer_id, dealer_code, dealer_name, customer_name, customer_phone, customer_city, customer_state, system_capacity_kw, panel_type, inverter_type, structure_type, total_amount, subsidy_amount, net_payable, annual_generation_kwh, status, share_token, request_id, share_expires_at, quote_payload, created_at, updated_at'
    : 'id, dealer_id, dealer_code, dealer_name, customer_name, customer_phone, customer_city, customer_state, system_capacity_kw, panel_type, inverter_type, structure_type, base_cost, dealer_margin, total_amount, subsidy_amount, net_payable, annual_generation_kwh, status, share_token, request_id, share_expires_at, quote_payload, created_at, updated_at';

  const { data, error } = await db
    .from('quotations')
    .select(selectColumns)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: 'Quotation not found.' });

  if (role === 'dealer') {
    const isDealerUuid = toValidUuid(dealer_id);
    const code = jwt.dealerCode || (isDealerUuid ? null : dealer_id);
    const matchId = isDealerUuid && data.dealer_id === dealer_id;
    const matchCode = code && data.dealer_code === code;
    if (!matchId && !matchCode) {
      return res.status(403).json({ error: 'Access denied to this quotation.' });
    }
  }

  return res.status(200).json({ success: true, quotation: data });
}

export async function handleDelete(req, res, jwt, db) {
  const { role, dealer_id } = jwt;
  const id = req.query?.id || req.body?.id;
  if (!id) return res.status(400).json({ error: 'id parameter is required.' });

  // Get share token and verify ownership
  const { data: existing, error: findErr } = await db
    .from('quotations')
    .select('id, dealer_id, dealer_code, share_token')
    .eq('id', id)
    .maybeSingle();

  if (findErr || !existing) return res.status(404).json({ error: 'Quotation not found.' });

  if (role === 'dealer') {
    const isDealerUuid = toValidUuid(dealer_id);
    const code = jwt.dealerCode || (isDealerUuid ? null : dealer_id);
    const matchId = isDealerUuid && existing.dealer_id === dealer_id;
    const matchCode = code && existing.dealer_code === code;
    if (!matchId && !matchCode) {
      return res.status(403).json({ error: 'Access denied: You cannot delete another dealer\'s quotation.' });
    }
  }

  if (existing.share_token) {
    await redisDel(_env, `quote:public:${existing.share_token}`).catch(() => {});
  }

  let query = db.from('quotations').delete().eq('id', id);
  if (role === 'dealer') {
    const isDealerUuid = toValidUuid(dealer_id);
    const code = jwt.dealerCode || (isDealerUuid ? null : dealer_id);
    if (isDealerUuid) {
      query = query.eq('dealer_id', dealer_id);
    } else if (code) {
      query = query.eq('dealer_code', code);
    }
  }

  const { error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // ── SEC-019 & BUG-01: Audit log entry in audit_logs table ───────────────────
  try {
    const { error: auditErr } = await db.from('audit_logs').insert([{
      actor_id: jwt.id || dealer_id || null,
      actor_role: role || 'unknown',
      action: 'quotation_deleted',
      entity_type: 'quotation',
      entity_id: id,
      details: { deletedQuotationId: id }
    }]);
    if (auditErr) {
      console.error('[audit_log insert failed]', auditErr.message);
    }
  } catch (auditException) {
    console.error('[audit_log insert exception]', auditException.message);
  }

  return res.status(200).json({ success: true, message: 'Quotation permanently deleted from database.' });
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  let db;
  try { db = getDb(); } catch (err) {
    return res.status(503).json({ error: 'Database service unavailable.' });
  }

  // Public proposal view — no auth required
  if (req.method === 'GET' && req.query?.action === 'public') {
    return handlePublicView(req, res, db);
  }

  // All other actions require authenticated user
  const jwt = await requireUser(req, res);
  if (!jwt) return;

  // Rate limit
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip, { maxAttempts: 60, windowMs: 60 * 1000, increment: false });
  if (!rateCheck.allowed) return res.status(429).json({ error: 'Too many requests.' });

  if (req.method === 'GET') {
    const action = req.query?.action || 'list';
    if (action === 'list') return handleList(req, res, jwt, db);
    if (action === 'get') return handleGet(req, res, jwt, db);
    return res.status(400).json({ error: 'Unknown action. Use list or get.' });
  }

  if (req.method === 'POST') {
    const action = req.body?.action;
    if (action === 'save') return handleSave(req, res, jwt, db);
    if (action === 'status') return handleStatus(req, res, jwt, db);
    if (action === 'delete') return handleDelete(req, res, jwt, db);
    return res.status(400).json({ error: 'Unknown action. Use save, status, or delete.' });
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res, jwt, db);
  }

  return res.status(405).json({ error: 'Method Not Allowed.' });
}



export async function onRequest(context) {
  const { request, env } = context;
  _env = env;
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return handleOptionsResponse(request, env);
  }

  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());

  let jwt = null;
  if (!(request.method === 'GET' && query.action === 'public')) {
    const { payload, errorResponse } = await requireUser(request, env);
    if (errorResponse) {
      for (const [k, v] of corsHeaders.entries()) errorResponse.headers.set(k, v);
      return errorResponse;
    }
    jwt = payload;
  }

  let db;
  try {
    db = getDb(env);
  } catch (err) {
    return Response.json({ error: 'Database service unavailable.' }, { status: 503, headers: corsHeaders });
  }

  let body = {};
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.clone().json();
    } catch (_) {}
  }

  const resObj = {
    _status: 200,
    _headers: new Headers(corsHeaders),
    status(s) { this._status = s; return this; },
    setHeader(k, v) { this._headers.set(k, v); return this; },
    json(data) {
      return Response.json(data, {
        status: this._status,
        headers: this._headers
      });
    },
    end(b = null) {
      return new Response(b, {
        status: this._status,
        headers: this._headers
      });
    }
  };

  const reqObj = {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    query,
    body,
    rawRequest: request
  };

  // Public proposal view — no auth required
  if (request.method === 'GET' && query.action === 'public') {
    return await handlePublicView(reqObj, resObj, db);
  }

  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(ip, { maxAttempts: 60, windowMs: 60 * 1000, increment: false });
  if (!rateCheck.allowed) {
    return Response.json({ error: 'Too many requests.' }, { status: 429, headers: corsHeaders });
  }

  if (request.method === 'GET') {
    const action = query.action || 'list';
    if (action === 'list') return await handleList(reqObj, resObj, jwt, db);
    if (action === 'get') return await handleGet(reqObj, resObj, jwt, db);
    return Response.json({ error: 'Unknown action. Use list or get.' }, { status: 400, headers: corsHeaders });
  }

  if (request.method === 'POST') {
    const action = body.action;
    if (action === 'save') return await handleSave(reqObj, resObj, jwt, db);
    if (action === 'status') return await handleStatus(reqObj, resObj, jwt, db);
    if (action === 'delete') return await handleDelete(reqObj, resObj, jwt, db);
    return Response.json({ error: 'Unknown action. Use save, status, or delete.' }, { status: 400, headers: corsHeaders });
  }

  if (request.method === 'DELETE') {
    return await handleDelete(reqObj, resObj, jwt, db);
  }

  return Response.json({ error: 'Method Not Allowed.' }, { status: 405, headers: corsHeaders });
}

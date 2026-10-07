import { createClient } from '@supabase/supabase-js';
import { verifyJwt } from './_lib/jwt.js';
import { getClientIp, checkDistributedRateLimit, checkRateLimit, recordFailedAttempt } from './_lib/rateLimiter.js';
import { cacheAside, redisDel } from './_lib/redis.js';
import { calculateSubsidy, calcBOMTotals, validateDealerMargin, calcFinalTotals } from '../src/shared/pricing/calculations.js';
import { getSettings } from './catalog.js';
import { STANDARD_BOM_CATALOG } from '../src/data/standardBomData.js';

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

function getDb() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error('[FATAL] SUPABASE_URL env var is required.');
  if (!serviceKey) throw new Error('[FATAL] SUPABASE_SERVICE_ROLE_KEY env var is required. Never fall back to the anon key for financial operations.');
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

// Valid status transitions per role
const STATUS_MACHINE = {
  admin: {
    Draft: ['Pending', 'Approved', 'Archived'],
    Pending: ['Approved', 'Rejected', 'Archived'],
    Approved: ['Archived'],
    Rejected: ['Archived'],
    Archived: []
  },
  dealer: {
    Draft: ['Pending'],
    Pending: [],
    Approved: [],
    Rejected: ['Draft'],  // dealer can re-draft a rejected quote
    Archived: []
  },
  staff: {
    Draft: ['Pending'],
    Pending: [],
    Approved: [],
    Rejected: [],
    Archived: []
  }
};

function canTransition(role, fromStatus, toStatus) {
  const allowed = STATUS_MACHINE[role]?.[fromStatus] || [];
  return allowed.includes(toStatus);
}

// ── BOM Catalog Map Cache ──────────────────────────────────────────────────
async function getBomCatalogMap(db) {
  const { data } = await cacheAside('catalog:bom_map', 21600, async () => {
    const { data: rows } = await db
      .from('bom_catalog')
      .select('*');

    const map = {};
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

    return map;
  });
  return data || {};
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

async function handleSave(req, res, jwt, db) {
  const { role, dealer_id, id: userId } = jwt;
  const body = req.body || {};

  // ── Load system settings first (Database-First Single Source of Truth) ─────
  const settings = await getSettings(db);
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

  if (quotationId) {
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

  // ── Load panel price from DB ───────────────────────────────────────────────
  let panelRatePerWp = 0;
  if (body.panel_id) {
    const { data: panelData } = await db
      .from('solar_modules')
      .select('rate_per_wp_inr, rate_per_wp')
      .eq('id', body.panel_id)
      .maybeSingle();
    if (!panelData) return res.status(422).json({ error: `Panel ${body.panel_id} not found.` });
    panelRatePerWp = Number(panelData.rate_per_wp_inr) || 0;
    if (!panelRatePerWp) {
      const rawStr = panelData.rate_per_wp || '';
      panelRatePerWp = Number(rawStr.replace(/[^0-9.]/g, '')) || 0;
    }
  }

  // ── Load inverter price from DB ────────────────────────────────────────────
  let inverterUnitPrice = 0;
  if (body.inverter_id) {
    const { data: invData } = await db
      .from('solar_inverters')
      .select('base_price_inr, base_price')
      .eq('id', body.inverter_id)
      .maybeSingle();
    if (invData) {
      inverterUnitPrice = Number(invData.base_price_inr) || 0;
      if (!inverterUnitPrice) {
        const rawStr = invData.base_price || '';
        inverterUnitPrice = Number(rawStr.replace(/[^0-9.]/g, '')) || 0;
      }
    }
  }

  // ── Load dealer margin cap strictly from DB (HC-03 / HC-04: No hardcoded fallback) ──
  let maxMarginCapPerKw = null;
  if (effectiveDealerId) {
    const { data: cachedDealer } = await cacheAside(`dealer:rates:${effectiveDealerId}`, 43200, async () => {
      const { data: dealerData } = await db
        .from('dealer_accounts')
        .select('max_margin_cap_per_kw, tier')
        .eq('id', effectiveDealerId)
        .maybeSingle();
      return dealerData || null;
    });

    if (cachedDealer?.max_margin_cap_per_kw != null && !isNaN(Number(cachedDealer.max_margin_cap_per_kw))) {
      maxMarginCapPerKw = Number(cachedDealer.max_margin_cap_per_kw);
    } else if (cachedDealer?.tier) {
      const { data: tierData } = await db
        .from('dealer_custom_pricing')
        .select('max_margin_cap_per_kw')
        .eq('tier', cachedDealer.tier)
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
      .eq('tier', 'Silver')
      .maybeSingle();
    if (defaultTier?.max_margin_cap_per_kw != null && !isNaN(Number(defaultTier.max_margin_cap_per_kw))) {
      maxMarginCapPerKw = Number(defaultTier.max_margin_cap_per_kw);
    }
  }

  if (maxMarginCapPerKw === null || isNaN(maxMarginCapPerKw)) {
    return res.status(422).json({ error: 'Dealer margin cap setting is missing from database.' });
  }

  // ── SEC-006: Server-side price EVERY BOM line item from bom_catalog ────────
  const bomCatalogMap = await getBomCatalogMap(db);
  const rawBomItems = Array.isArray(body.bom_items) ? body.bom_items : [];

  const sanitizedBom = [];
  for (const item of rawBomItems) {
    if (item.id === 'solar_panel') {
      const qty = Math.min(10000, Math.max(0, Number(item.qty) || 0));
      const rate = panelRatePerWp > 0
        ? Math.round(Number(body.panel_watt || 550) * panelRatePerWp)
        : Math.max(0, Number(item.rate) || 0);
      sanitizedBom.push({ ...item, qty, rate, gstRate: 5 });
      continue;
    }
    if (item.id === 'solar_inverter') {
      const qty = Math.min(10000, Math.max(0, Number(item.qty) || 0));
      const rate = inverterUnitPrice > 0 ? inverterUnitPrice : Math.max(0, Number(item.rate) || 0);
      sanitizedBom.push({ ...item, qty, rate, gstRate: 5 });
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
    let rate = Number(item.rate);
    if (isNaN(rate) || rate <= 0) {
      rate = catEntry.defaultRate;
    } else {
      const minR = catEntry.minRate !== undefined ? catEntry.minRate : 0;
      const maxR = catEntry.maxRate !== undefined ? catEntry.maxRate : (catEntry.defaultRate > 0 ? catEntry.defaultRate * 2 : 100000);
      rate = Math.min(maxR, Math.max(minR, rate));
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

  const supplierState = String(body.supplier_state || 'Gujarat').trim();
  const peakSunHours = Number(body.peak_sun_hours) || settings?.governance_settings?.default_specific_yield || 1440;
  const isInterState = String(body.customer_state || supplierState).trim().toLowerCase() !== supplierState.trim().toLowerCase();
  const bomTotals = calcBOMTotals(sanitizedBom, isInterState, settings?.statutory_taxes?.gstSlabs);

  // Margin validation and capping
  const clientMargin = Number(body.dealer_margin_inr) || 0;
  const isDirectCompany = body.is_direct_company_quote === true;
  const { effectiveMargin, isMarginExceeded } = validateDealerMargin(
    isDirectCompany ? 0 : clientMargin,
    kw,
    maxMarginCapPerKw
  );

  // PM Surya Ghar Subsidy
  const subsidyAmount = calculateSubsidy(kw, body.project_type || 'Residential', settings);

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

  // ── Build frozen quote_payload ─────────────────────────────────────────────
  const quotePayload = {
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
    serverVersion: '2.1'
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

  const record = {
    id: quotationId,
    dealer_id: effectiveDealerId,
    dealer_code: body.dealer_code || null,
    dealer_name: body.dealer_name || null,
    customer_name: String(body.customer_name).trim(),
    customer_phone: String(body.customer_phone).trim(),
    customer_city: body.customer_city || null,
    customer_state: body.customer_state || 'Gujarat',
    system_capacity_kw: kw,
    panel_type: body.panel_type || null,
    inverter_type: body.inverter_type || null,
    structure_type: body.structure_type || null,
    // Server-computed financial fields (client values IGNORED)
    base_cost: bomTotals.grossTurnkeyCost,
    dealer_margin: effectiveMargin,
    total_amount: totalAmount,
    subsidy_amount: subsidyAmount,
    net_payable: netPayable,
    annual_generation_kwh: Math.round(kw * peakSunHours),
    ...(isNew && { status: 'Draft' }),
    request_id: body.request_id || null,
    share_expires_at: shareExpiresAt,
    quote_payload: quotePayload,
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
    await redisDel(`quote:public:${data?.share_token || body?.share_token}`).catch(() => {});
  }

  // ── SEC-019 & BUG-01: Audit log entry in audit_logs table ───────────────────
  try {
    const { error: auditErr } = await db.from('audit_logs').insert([{
      actor_id: userId || effectiveDealerId || null,
      actor_role: role || 'unknown',
      action: isNew ? 'quotation_created' : 'quotation_updated',
      entity_type: 'quotation',
      entity_id: quotationId,
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
    quotation: {
      ...data,
      _marginExceededAndCapped: isMarginExceeded,
      _clampedDiscount: clampedDiscount
    }
  });
}

async function handleStatus(req, res, jwt, db) {
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
    await redisDel(`quote:public:${existing.share_token}`).catch(() => {});
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
async function handlePublicView(req, res, db) {
  const { token } = req.query || {};
  if (!token) return res.status(400).json({ error: 'share_token is required.' });

  const clientIp = getClientIp(req);
  // Distributed Rate Limit for public links: 30 requests/minute per IP
  const rateCheck = await checkDistributedRateLimit(`pub:${clientIp}`, { maxAttempts: 30, windowMs: 60 * 1000 });
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: `Too many requests. Try again in ${rateCheck.resetSeconds}s.` });
  }

  // Cache-Aside with 7-day sliding safety TTL
  const { data, fromCache } = await cacheAside(`quote:public:${token}`, 604800, async () => {
    const { data: quoteData } = await db
      .from('quotations')
      .select('id, customer_name, system_capacity_kw, panel_type, inverter_type, structure_type, total_amount, subsidy_amount, net_payable, annual_generation_kwh, status, quote_payload, share_expires_at, created_at')
      .eq('share_token', token)
      .neq('status', 'Archived')
      .maybeSingle();

    if (!quoteData) return null;

    const isExpired = quoteData.share_expires_at && new Date(quoteData.share_expires_at).getTime() < Date.now();

    return {
      id: quoteData.id,
      customerName: quoteData.customer_name,
      systemCapacityKw: quoteData.system_capacity_kw,
      panelType: quoteData.panel_type,
      inverterType: quoteData.inverter_type,
      structureType: quoteData.structure_type,
      totalAmount: quoteData.total_amount,
      subsidyAmount: quoteData.subsidy_amount,
      netPayable: quoteData.net_payable,
      annualGenerationKwh: quoteData.annual_generation_kwh,
      status: quoteData.status,
      shareExpiresAt: quoteData.share_expires_at,
      isExpired,
      bomItems: quoteData.quote_payload?.bomItems || [],
      bomTotals: quoteData.quote_payload?.bomTotals || {},
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
async function handleList(req, res, jwt, db) {
  const { role, dealer_id } = jwt;
  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);

  // Column projection: dealers do not receive internal staff fields
  const selectColumns = role === 'dealer'
    ? 'id, dealer_id, dealer_code, dealer_name, customer_name, customer_phone, customer_city, customer_state, system_capacity_kw, panel_type, inverter_type, structure_type, total_amount, subsidy_amount, net_payable, annual_generation_kwh, status, share_token, request_id, share_expires_at, created_at, updated_at'
    : 'id, dealer_id, dealer_code, dealer_name, customer_name, customer_phone, customer_city, customer_state, system_capacity_kw, panel_type, inverter_type, structure_type, base_cost, dealer_margin, total_amount, subsidy_amount, net_payable, annual_generation_kwh, status, share_token, request_id, share_expires_at, created_at, updated_at';

  let query = db
    .from('quotations')
    .select(selectColumns, { count: 'exact' });

  if (role === 'dealer') {
    query = query.eq('dealer_id', dealer_id);
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

async function handleGet(req, res, jwt, db) {
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

  if (role === 'dealer' && data.dealer_id !== dealer_id) {
    return res.status(403).json({ error: 'Access denied to this quotation.' });
  }

  return res.status(200).json({ success: true, quotation: data });
}

async function handleDelete(req, res, jwt, db) {
  const { role, dealer_id } = jwt;
  const id = req.query?.id || req.body?.id;
  if (!id) return res.status(400).json({ error: 'id parameter is required.' });

  // Get share token and verify ownership
  const { data: existing, error: findErr } = await db
    .from('quotations')
    .select('id, dealer_id, share_token')
    .eq('id', id)
    .maybeSingle();

  if (findErr || !existing) return res.status(404).json({ error: 'Quotation not found.' });

  if (role === 'dealer' && existing.dealer_id !== dealer_id) {
    return res.status(403).json({ error: 'Access denied: You cannot delete another dealer\'s quotation.' });
  }

  if (existing.share_token) {
    await redisDel(`quote:public:${existing.share_token}`).catch(() => {});
  }

  let query = db.from('quotations').delete().eq('id', id);
  if (role === 'dealer') {
    query = query.eq('dealer_id', dealer_id);
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

  // All other actions require JWT
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.sunvine_auth_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const jwtResult = verifyJwt(token);
  if (!jwtResult.valid) return res.status(401).json({ error: 'Authentication required.' });
  const jwt = jwtResult.payload;

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



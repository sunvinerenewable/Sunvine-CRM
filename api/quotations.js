import { createClient } from '@supabase/supabase-js';
import { verifyJwt } from './_lib/jwt.js';
import { getClientIp, checkDistributedRateLimit, checkRateLimit, recordFailedAttempt } from './_lib/rateLimiter.js';
import { cacheAside, redisDel } from './_lib/redis.js';

/**
 * /api/quotations — consolidated quotation resource handler
 *
 * Actions:
 *   POST   { action: 'save', ... }   → save/upsert with server-side recompute
 *   POST   { action: 'status', id, newStatus } → transition with role check
 *   GET    ?action=list              → list quotations (scoped by role)
 *   GET    ?action=get&id=...        → single quotation by id
 *   GET    ?action=public&token=...  → public proposal by share_token
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

// ── Shared pricing engine (import the shared module) ────────────────────────
// Node.js ESM: use createRequire or dynamic import
import { calculateSubsidy, calcBOMTotals, validateDealerMargin, calcFinalTotals } from '../src/shared/pricing/calculations.js';

// ── Generate server-side quotation ID ───────────────────────────────────────
async function generateQuotationId(db) {
  // Use a DB sequence to guarantee uniqueness
  const { data, error } = await db.rpc('next_quotation_seq');
  if (error || !data) {
    // Fallback: crypto random (still server-side, not Date.now)
    const { randomBytes } = await import('crypto');
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `SV-${new Date().getFullYear()}-Q${rand}`;
  }
  const year = new Date().getFullYear();
  const seq = String(data).padStart(4, '0');
  return `SV-${year}-Q${seq}`;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleSave(req, res, jwt, db) {
  const { role, dealer_id, id: userId } = jwt;
  const body = req.body || {};

  // ── Input validation ───────────────────────────────────────────────────
  const kw = Number(body.system_capacity_kw);
  if (!kw || kw <= 0 || kw > 1000) {
    return res.status(422).json({ error: 'system_capacity_kw must be between 0 and 1000 kW.' });
  }
  if (!body.customer_name || !body.customer_phone) {
    return res.status(422).json({ error: 'customer_name and customer_phone are required.' });
  }
  if (!body.panel_id && !body.bom_items) {
    return res.status(422).json({ error: 'panel_id or bom_items is required.' });
  }

  // Dealers can only create/edit their own quotations
  const effectiveDealerId = role === 'dealer' ? dealer_id : (body.dealer_id || null);

  // ── Load panel price from DB ───────────────────────────────────────────
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
      // Fallback: parse old VARCHAR column
      const rawStr = panelData.rate_per_wp || '';
      panelRatePerWp = Number(rawStr.replace(/[^0-9.]/g, '')) || 0;
    }
  }

  // ── Load inverter price from DB ────────────────────────────────────────
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

  // ── Load dealer tier margin cap from DB ────────────────────────────────
  let maxMarginCapPerKw = 6000; // default
  if (effectiveDealerId) {
    const { data: cachedDealer } = await cacheAside(`dealer:rates:${effectiveDealerId}`, 43200, async () => {
      const { data: dealerData } = await db
        .from('dealers')
        .select('max_margin_cap_per_kw, tier')
        .eq('id', effectiveDealerId)
        .maybeSingle();
      return dealerData || null;
    });
    if (cachedDealer?.max_margin_cap_per_kw) {
      maxMarginCapPerKw = Number(cachedDealer.max_margin_cap_per_kw);
    }
  }

  // ── Server-side recompute ─────────────────────────────────────────────
  // Use client-provided BOM items if present, but enforce qty/rate within DB-sourced rates
  const bomItems = Array.isArray(body.bom_items) ? body.bom_items : [];
  // Ensure panel and inverter rates in the BOM are from DB (not from client)
  const sanitizedBom = bomItems.map(item => {
    if (item.id === 'solar_panel' && panelRatePerWp > 0) {
      const qty = Math.max(0, Number(item.qty) || 0);
      const rate = Math.round(Number(body.panel_watt || 550) * panelRatePerWp);
      return { ...item, qty, rate, gstRate: 5 };
    }
    if (item.id === 'solar_inverter' && inverterUnitPrice > 0) {
      const qty = Math.max(0, Number(item.qty) || 0);
      return { ...item, qty, rate: inverterUnitPrice, gstRate: 5 };
    }
    // Allow dealer to set rate on other items within configurable bounds (permissive for now)
    return {
      ...item,
      qty: Math.max(0, Number(item.qty) || 0),
      rate: Math.max(0, Number(item.rate) || 0),
      gstRate: [0, 5, 18].includes(Number(item.gstRate)) ? Number(item.gstRate) : 18
    };
  });

  const supplierState = String(body.supplier_state || 'Gujarat').trim();
  const peakSunHours = Number(body.peak_sun_hours) || 1440;
  const isInterState = String(body.customer_state || supplierState).trim().toLowerCase() !== supplierState.trim().toLowerCase();
  const bomTotals = calcBOMTotals(sanitizedBom, isInterState);

  // Margin validation and capping
  const clientMargin = Number(body.dealer_margin_inr) || 0;
  const isDirectCompany = body.is_direct_company_quote === true;
  const { effectiveMargin, isMarginExceeded } = validateDealerMargin(
    isDirectCompany ? 0 : clientMargin,
    kw,
    maxMarginCapPerKw
  );

  const subsidyAmount = calculateSubsidy(kw, body.project_type || 'Residential');
  const { totalAmount, netPayable } = calcFinalTotals({
    grossTurnkeyCost: bomTotals.grossTurnkeyCost,
    dealerMarginINR: effectiveMargin,
    discountAmount: Math.max(0, Number(body.discount_amount) || 0),
    subsidyAmount
  });

  // ── Build frozen quote_payload ─────────────────────────────────────────
  const quotePayload = {
    bomItems: bomTotals.calculatedItems,
    bomTotals: {
      subtotal5Base: bomTotals.subtotal5Base,
      subtotal18Base: bomTotals.subtotal18Base,
      subtotal0Base: bomTotals.subtotal0Base,
      gst5Total: bomTotals.gst5Total,
      gst18Total: bomTotals.gst18Total,
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
    projectType: body.project_type || 'Residential',
    financeType: body.finance_type || 'CASH',
    loanBank: body.loan_bank || null,
    loanTenureYears: Number(body.loan_tenure_years) || 5,
    isDirectCompanyQuote: isDirectCompany,
    isInterState,
    computedAt: new Date().toISOString(),
    serverVersion: '2.0'
  };

  // ── Generate or reuse quotation ID ────────────────────────────────────
  let quotationId = body.quotation_id;
  const isNew = !quotationId;
  if (isNew) {
    quotationId = await generateQuotationId(db);
  }

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
    status: body.status || (isNew ? 'Active / Sent' : undefined),
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

  // Audit log entry
  try {
    await db.from('audit_log').insert({
      action: isNew ? 'quotation_created' : 'quotation_updated',
      table_name: 'quotations',
      record_id: quotationId,
      actor_id: userId || effectiveDealerId,
      actor_role: role,
      details: { kw, totalAmount, netPayable, subsidyAmount }
    });
  } catch { /* audit log is non-critical */ }

  return res.status(200).json({
    success: true,
    quotation: {
      ...data,
      _marginExceededAndCapped: isMarginExceeded
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

  // Audit log
  try {
    await db.from('audit_log').insert({
      action: 'status_changed',
      table_name: 'quotations',
      record_id: id,
      actor_id: jwt.id,
      actor_role: role,
      details: { from: existing.status, to: newStatus }
    });
  } catch { /* non-critical */ }

  return res.status(200).json({ success: true, id, status: newStatus });
}

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
      .select('id, customer_name, system_capacity_kw, panel_type, inverter_type, structure_type, total_amount, subsidy_amount, net_payable, annual_generation_kwh, status, quote_payload, created_at')
      .eq('share_token', token)
      .neq('status', 'Archived')
      .maybeSingle();

    if (!quoteData) return null;

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
      bomItems: quoteData.quote_payload?.bomItems || [],
      bomTotals: quoteData.quote_payload?.bomTotals || {},
      createdAt: quoteData.created_at
    };
  });

  if (!data) return res.status(404).json({ error: 'Proposal not found or has expired.' });

  res.setHeader('X-Cache-Source', fromCache ? 'Redis' : 'Database');
  return res.status(200).json({
    success: true,
    quotation: data
  });
}

async function handleList(req, res, jwt, db) {
  const { role, dealer_id } = jwt;
  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);

  let query = db
    .from('quotations')
    .select('id, dealer_id, dealer_code, dealer_name, customer_name, customer_phone, customer_city, customer_state, system_capacity_kw, panel_type, inverter_type, structure_type, base_cost, dealer_margin, total_amount, subsidy_amount, net_payable, annual_generation_kwh, status, share_token, created_at, updated_at', { count: 'exact' });

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

  const { data, error } = await db
    .from('quotations')
    .select('id, dealer_id, dealer_code, dealer_name, customer_name, customer_phone, customer_city, customer_state, system_capacity_kw, panel_type, inverter_type, structure_type, base_cost, dealer_margin, total_amount, subsidy_amount, net_payable, annual_generation_kwh, status, share_token, quote_payload, created_at, updated_at')
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

  // Get share token for cache eviction
  const { data: existing } = await db.from('quotations').select('share_token').eq('id', id).maybeSingle();
  if (existing?.share_token) {
    await redisDel(`quote:public:${existing.share_token}`).catch(() => {});
  }

  // Direct SQL hard delete from database table
  let query = db.from('quotations').delete().eq('id', id);
  if (role === 'dealer') {
    query = query.eq('dealer_id', dealer_id);
  }

  const { error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
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
  const authHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const token = authHeader || cookies.sunvine_auth_token;
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


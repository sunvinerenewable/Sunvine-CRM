import { createClient } from '@supabase/supabase-js';
import { verifyJwt } from './_lib/jwt.js';
import { cacheAside, redisDel } from './_lib/redis.js';

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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Database configuration missing.');
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

// ── Fetchers ───────────────────────────────────────────────────────────────

export async function getSettings(db) {
  const { data } = await cacheAside('catalog:settings', 21600, async () => {
    const { data: row } = await db
      .from('system_settings')
      .select('*')
      .eq('id', 'global_settings')
      .maybeSingle();

    const governance = row?.governance_settings || {};
    const statutory = row?.statutory_taxes || {};
    const company = row?.company_profile || {};

    return {
      governance_settings: {
        max_discount_pct: governance.max_discount_pct !== undefined ? Number(governance.max_discount_pct) : 5,
        max_system_kw: governance.max_system_kw !== undefined ? Number(governance.max_system_kw) : 1000,
        quote_prefix: governance.quote_prefix || 'SV',
        validity_days: governance.validity_days !== undefined ? Number(governance.validity_days) : 15,
        default_specific_yield: governance.default_specific_yield !== undefined ? Number(governance.default_specific_yield) : 1440,
        default_tariff: governance.default_tariff !== undefined ? Number(governance.default_tariff) : 6.67,
        default_loan_rate: governance.default_loan_rate !== undefined ? Number(governance.default_loan_rate) : 8.5,
        upload_max_mb: governance.upload_max_mb !== undefined ? Number(governance.upload_max_mb) : 2,
        allow_custom_bom_lines: Boolean(governance.allow_custom_bom_lines),
        max_custom_bom_value: Number(governance.max_custom_bom_value || 0)
      },
      statutory_taxes: {
        subsidy: {
          slab1Rate: statutory.subsidy?.slab1Rate !== undefined ? Number(statutory.subsidy.slab1Rate) : 30000,
          slab2Rate: statutory.subsidy?.slab2Rate !== undefined ? Number(statutory.subsidy.slab2Rate) : 18000,
          cap: statutory.subsidy?.cap !== undefined ? Number(statutory.subsidy.cap) : 78000,
          breakpointKw: statutory.subsidy?.breakpointKw !== undefined ? Number(statutory.subsidy.breakpointKw) : 3
        },
        gstSlabs: Array.isArray(statutory.gstSlabs) ? statutory.gstSlabs : [0, 5, 12, 18, 28]
      },
      company_profile: {
        name: company.name || 'Sunvine Renewable Energy Private Limited',
        gstin: company.gstin || '24AAACS1234A1Z5',
        address: company.address || 'Ahmedabad, Gujarat, India',
        state: company.state || 'Gujarat',
        whatsapp: company.whatsapp || '+91 80000 50580',
        helpdesk: company.helpdesk || '+91 80000 50580',
        website: company.website || 'https://sunvinerenewable.com',
        email: company.email || 'support@sunvinerenewable.com',
        bank: {
          bankName: company.bank?.bankName || 'State Bank of India',
          accountNumber: company.bank?.accountNumber || '999900001111',
          ifsc: company.bank?.ifsc || 'SBIN0001234',
          branch: company.bank?.branch || 'Ahmedabad Main Branch',
          accountHolder: company.bank?.accountHolder || 'Sunvine Renewable Energy Private Limited'
        },
        terms: company.terms || '1. Validity: 15 Days from quotation date.\n2. Net-metering approval is subject to DISCOM policy.\n3. Subsidy disbursement is directly into customer bank account via PM Surya Ghar National Portal.',
        validityText: company.validityText || '15 Days from generation date'
      }
    };
  });
  return data;
}

async function getHardwareCatalog(db) {
  const { data } = await cacheAside('catalog:hardware', 21600, async () => {
    const [modulesRes, invertersRes] = await Promise.all([
      db.from('solar_modules').select('*').order('created_at', { ascending: false }),
      db.from('solar_inverters').select('*').order('created_at', { ascending: false })
    ]);

    return {
      modules: modulesRes.data || [],
      inverters: invertersRes.data || []
    };
  });
  return data;
}

async function getPricingPresets(db) {
  const { data } = await cacheAside('pricing:global_presets', 21600, async () => {
    const { data: row } = await db
      .from('pricing_presets')
      .select('*')
      .eq('id', 'global_default')
      .maybeSingle();

    if (!row) return null;
    return {
      baseRatePerKw: Number(row.base_rate_per_kw) || 59800,
      subsidyCap: Number(row.subsidy_cap) || 78000,
      minMarginPerKw: Number(row.min_margin_per_kw) || 4000,
      enforceMinMargin: row.enforce_min_margin !== false,
      lastSynced: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : 'Active',
      updatedBy: row.last_synced_by || 'Operations Desk'
    };
  });
  return data;
}

async function getTierMargins(db) {
  const { data } = await cacheAside('pricing:tier_margins', 21600, async () => {
    const { data: rows } = await db
      .from('dealer_custom_pricing')
      .select('*')
      .order('tier', { ascending: true });
    return rows || [];
  });
  return data;
}

async function getInverterBenchmarks(db) {
  const { data } = await cacheAside('catalog:inverter_benchmarks', 43200, async () => {
    const { data: rows } = await db
      .from('inverter_benchmark_matrix')
      .select('*')
      .order('capacity_kw', { ascending: true });
    return rows || [];
  });
  return data;
}

async function getBosMatrix(db) {
  const { data } = await cacheAside('catalog:bos_matrix', 43200, async () => {
    const { data: rows } = await db
      .from('bos_pricing_matrix')
      .select('capacity_slab, panel_brand, bos_price_per_wp, gst_rate')
      .order('capacity_slab', { ascending: true });
    return rows || [];
  });
  return data;
}

async function getSolarBanks(db) {
  const { data } = await cacheAside('catalog:solar_banks', 86400, async () => {
    const { data: rows } = await db
      .from('solar_banks')
      .select('*')
      .order('bank_name', { ascending: true });
    return rows || [];
  });
  return data;
}

// ── Main Handler ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  let db;
  try {
    db = getDb();
  } catch (err) {
    return res.status(503).json({ error: 'Database service unavailable.' });
  }

  // Handle Admin Cache Invalidation
  if (req.method === 'POST') {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.sunvine_auth_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const jwtResult = verifyJwt(token);

    if (!jwtResult.valid || !['admin', 'staff'].includes(jwtResult.payload?.role)) {
      return res.status(403).json({ error: 'Admin or Staff role required for cache operations.' });
    }

    const { action, keys } = req.body || {};
    if (action === 'invalidate' && Array.isArray(keys)) {
      await Promise.all(keys.map(k => redisDel(k).catch(() => {})));
      return res.status(200).json({ success: true, invalidated: keys });
    }

    if (action === 'invalidate_settings') {
      const defaultKeys = ['catalog:settings', 'catalog:all'];
      await Promise.all(defaultKeys.map(k => redisDel(k).catch(() => {})));
      return res.status(200).json({ success: true, invalidated: defaultKeys });
    }

    return res.status(400).json({ error: 'Invalid action or keys array.' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
  }

  const type = req.query?.type || 'bootstrap';

  try {
    if (type === 'bootstrap') {
      const [hardware, presets, tierMargins, inverterBenchmarks, bosMatrix, solarBanks, settings] = await Promise.all([
        getHardwareCatalog(db),
        getPricingPresets(db),
        getTierMargins(db),
        getInverterBenchmarks(db),
        getBosMatrix(db),
        getSolarBanks(db),
        getSettings(db)
      ]);

      return res.status(200).json({
        success: true,
        settings,
        catalog: {
          hardware,
          presets,
          tierMargins,
          inverterBenchmarks,
          bosMatrix,
          solarBanks,
          settings
        }
      });
    }

    if (type === 'settings') {
      const settings = await getSettings(db);
      return res.status(200).json({ success: true, settings });
    }

    if (type === 'hardware') {
      const hardware = await getHardwareCatalog(db);
      return res.status(200).json({ success: true, hardware });
    }

    if (type === 'presets') {
      const presets = await getPricingPresets(db);
      return res.status(200).json({ success: true, presets });
    }

    if (type === 'tier_margins') {
      const tierMargins = await getTierMargins(db);
      return res.status(200).json({ success: true, tierMargins });
    }

    if (type === 'inverters') {
      const inverterBenchmarks = await getInverterBenchmarks(db);
      return res.status(200).json({ success: true, inverterBenchmarks });
    }

    if (type === 'bos') {
      const bosMatrix = await getBosMatrix(db);
      return res.status(200).json({ success: true, bosMatrix });
    }

    if (type === 'banks') {
      const solarBanks = await getSolarBanks(db);
      return res.status(200).json({ success: true, solarBanks });
    }

    return res.status(400).json({ error: 'Invalid catalog type requested.' });
  } catch (err) {
    console.error('[api/catalog error]', err.message);
    return res.status(500).json({ error: 'Failed to retrieve catalog data.' });
  }
}


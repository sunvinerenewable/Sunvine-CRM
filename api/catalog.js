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

    return res.status(400).json({ error: 'Invalid action or keys array.' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
  }

  const type = req.query?.type || 'bootstrap';

  try {
    if (type === 'bootstrap') {
      const [hardware, presets, tierMargins, inverterBenchmarks, bosMatrix, solarBanks] = await Promise.all([
        getHardwareCatalog(db),
        getPricingPresets(db),
        getTierMargins(db),
        getInverterBenchmarks(db),
        getBosMatrix(db),
        getSolarBanks(db)
      ]);

      return res.status(200).json({
        success: true,
        catalog: {
          hardware,
          presets,
          tierMargins,
          inverterBenchmarks,
          bosMatrix,
          solarBanks
        }
      });
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

import { supabase } from '../lib/supabase';

const DEALER_PRICING_KEY = 'sunvine_dealer_custom_pricing_v2';
const PRICING_PRESETS_KEY = 'sunvine_pricing_presets';
const BOS_MATRIX_KEY = 'sunvine_bos_matrix_v2';
const INVERTER_BENCHMARKS_KEY = 'sunvine_inverter_benchmark_matrix';
const BOM_CATALOG_KEY = 'sunvine_bom_catalog_v2';
const TIER_MARGINS_KEY = 'sunvine_tier_margins';

async function invalidateCatalogCache(keys) {
  try {
    await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalidate', keys: Array.isArray(keys) ? keys : [keys] })
    });
  } catch (_) {}
}

export const pricingService = {
  // ==========================================
  // 1. GLOBAL PRICING PRESETS
  // ==========================================
  async getPricingPresets() {
    // 1. Fast Cache-Aside via serverless /api/catalog
    try {
      const res = await fetch('/api/catalog?type=presets');
      if (res.ok) {
        const json = await res.json();
        if (json?.presets) {
          localStorage.setItem(PRICING_PRESETS_KEY, JSON.stringify(json.presets));
          return json.presets;
        }
      }
    } catch (_) {}

    // 2. Direct Supabase Query Fallback
    try {
      const { data, error } = await supabase
        .from('pricing_presets')
        .select('*')
        .eq('id', 'global_default')
        .single();

      if (!error && data) {
        const presets = {
          baseRatePerKw: Number(data.base_rate_per_kw) || 59800,
          subsidyCap: Number(data.subsidy_cap) || 78000,
          minMarginPerKw: Number(data.min_margin_per_kw) || 4000,
          enforceMinMargin: data.enforce_min_margin !== false,
          lastSynced: data.updated_at ? new Date(data.updated_at).toLocaleDateString() : 'Active',
          updatedBy: data.last_synced_by || 'Operations Desk'
        };
        localStorage.setItem(PRICING_PRESETS_KEY, JSON.stringify(presets));
        return presets;
      }
    } catch (err) {
      console.warn('Supabase fetch pricing presets fallback:', err);
    }

    try {
      const cached = localStorage.getItem(PRICING_PRESETS_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  },

  async savePricingPresets(presets) {
    if (!presets) return { success: false, error: 'Presets required' };

    try {
      localStorage.setItem(PRICING_PRESETS_KEY, JSON.stringify(presets));
    } catch (_) {}

    try {
      const payload = {
        id: 'global_default',
        base_rate_per_kw: Number(presets.baseRatePerKw) || 59800,
        subsidy_cap: Number(presets.subsidyCap) || 78000,
        min_margin_per_kw: Number(presets.minMarginPerKw) || 4000,
        enforce_min_margin: presets.enforceMinMargin !== false,
        last_synced_by: presets.updatedBy || 'Operations Desk',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('pricing_presets')
        .upsert([payload], { onConflict: 'id' })
        .select();

      // Invalidate Redis cache
      invalidateCatalogCache(['pricing:global_presets']);

      if (error) {
        console.warn('Supabase save pricing presets notice:', error.message);
        return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database: ' + error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database. Check your connection.' };
    }
  },

  // ==========================================
  // 2. BOS PRICING MATRIX
  // ==========================================
  async getBosMatrix() {
    try {
      const { data, error } = await supabase
        .from('bos_pricing_matrix')
        .select('*')
        .order('capacity_kw', { ascending: true });

      if (!error && data && data.length > 0) {
        const matrix = data.map(row => ({
          capacityKW: Number(row.capacity_kw),
          noOfModules: Number(row.no_of_modules),
          inverterCapacityKW: row.inverter_capacity_kw,
          adaniBiFiPrice: Number(row.adani_bifi_price),
          apsBiFiPrice: Number(row.aps_bifi_price),
          rayzonePrice: Number(row.rayzone_price),
          topcon585CapacityKW: Number(row.topcon585_capacity_kw) || (Number(row.capacity_kw) * 1.06),
          waaree585Price: Number(row.waaree_585_price),
          topcon600CapacityKW: Number(row.topcon600_capacity_kw) || (Number(row.capacity_kw) * 1.09),
          apsTopcon600Price: Number(row.aps_topcon_600_price)
        }));
        localStorage.setItem(BOS_MATRIX_KEY, JSON.stringify(matrix));
        return matrix;
      }
    } catch (err) {
      console.warn('Supabase fetch BOS matrix fallback:', err);
    }

    try {
      const cached = localStorage.getItem(BOS_MATRIX_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  },

  async saveBosMatrix(matrixList) {
    if (!Array.isArray(matrixList) || matrixList.length === 0) {
      return { success: false, error: 'Valid matrix list required' };
    }

    try {
      localStorage.setItem(BOS_MATRIX_KEY, JSON.stringify(matrixList));
    } catch (_) {}

    try {
      const rows = matrixList.map((item, idx) => ({
        id: `bos-${String(item.capacityKW).replace('.', '_')}`,
        capacity_kw: Number(item.capacityKW),
        no_of_modules: Number(item.noOfModules) || 2,
        inverter_capacity_kw: String(item.inverterCapacityKW || item.capacityKW),
        adani_bifi_price: Number(item.adaniBiFiPrice) || 0,
        aps_bifi_price: Number(item.apsBiFiPrice) || 0,
        rayzone_price: Number(item.rayzonePrice) || 0,
        topcon585_capacity_kw: Number(item.topcon585CapacityKW) || Number(item.capacityKW),
        waaree_585_price: Number(item.waaree585Price) || 0,
        topcon600_capacity_kw: Number(item.topcon600CapacityKW) || Number(item.capacityKW),
        aps_topcon_600_price: Number(item.apsTopcon600Price) || 0,
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('bos_pricing_matrix')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase save BOS matrix notice:', error.message);
        return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database: ' + error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database. Check your connection.' };
    }
  },

  async deleteBosSlab(capacityKwOrId) {
    try {
      if (typeof capacityKwOrId === 'number' || !isNaN(Number(capacityKwOrId))) {
        await supabase.from('bos_pricing_matrix').delete().eq('capacity_kw', Number(capacityKwOrId));
      } else {
        await supabase.from('bos_pricing_matrix').delete().eq('id', capacityKwOrId);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ==========================================
  // 3. INVERTER BENCHMARKS MATRIX
  // ==========================================
  async getInverterBenchmarks() {
    // 1. Fast Cache-Aside via serverless /api/catalog
    try {
      const res = await fetch('/api/catalog?type=inverters');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.inverterBenchmarks) && json.inverterBenchmarks.length > 0) {
          const benchmarks = json.inverterBenchmarks.map(row => ({
            capacityKW: Number(row.capacity_kw),
            brand: row.brand,
            series: row.series,
            phase: row.phase,
            benchmarkPrice: Number(row.benchmark_price)
          }));
          localStorage.setItem(INVERTER_BENCHMARKS_KEY, JSON.stringify(benchmarks));
          return benchmarks;
        }
      }
    } catch (_) {}

    // 2. Direct Supabase Query Fallback
    try {
      const { data, error } = await supabase
        .from('inverter_benchmark_matrix')
        .select('*')
        .order('capacity_kw', { ascending: true });

      if (!error && data && data.length > 0) {
        const benchmarks = data.map(row => ({
          capacityKW: Number(row.capacity_kw),
          brand: row.brand,
          series: row.series,
          phase: row.phase,
          benchmarkPrice: Number(row.benchmark_price)
        }));
        localStorage.setItem(INVERTER_BENCHMARKS_KEY, JSON.stringify(benchmarks));
        return benchmarks;
      }
    } catch (err) {
      console.warn('Supabase fetch inverter benchmarks fallback:', err);
    }

    try {
      const cached = localStorage.getItem(INVERTER_BENCHMARKS_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  },

  async saveInverterBenchmarks(benchmarks) {
    if (!Array.isArray(benchmarks) || benchmarks.length === 0) {
      return { success: false, error: 'Valid benchmarks required' };
    }

    try {
      localStorage.setItem(INVERTER_BENCHMARKS_KEY, JSON.stringify(benchmarks));
    } catch (_) {}

    try {
      const rows = benchmarks.map((bm, idx) => ({
        id: `inv-bm-${idx + 1}`,
        capacity_kw: Number(bm.capacityKW),
        brand: bm.brand,
        series: bm.series,
        phase: bm.phase,
        benchmark_price: Number(bm.benchmarkPrice),
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('inverter_benchmark_matrix')
        .upsert(rows, { onConflict: 'id' });

      // Invalidate Redis cache
      invalidateCatalogCache(['catalog:inverter_benchmarks']);

      if (error) {
        console.warn('Supabase save inverter benchmarks notice:', error.message);
        return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database: ' + error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database. Check your connection.' };
    }
  },

  async deleteInverterBenchmark(idOrCapacity) {
    try {
      if (typeof idOrCapacity === 'number' || !isNaN(Number(idOrCapacity))) {
        await supabase.from('inverter_benchmark_matrix').delete().eq('capacity_kw', Number(idOrCapacity));
      } else {
        await supabase.from('inverter_benchmark_matrix').delete().eq('id', idOrCapacity);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ==========================================
  // 4. BILL OF MATERIALS (BOM) CATALOG
  // ==========================================
  async getBomCatalog() {
    try {
      const { data, error } = await supabase
        .from('bom_catalog')
        .select('*')
        .order('capacity_kw', { ascending: true });

      if (!error && data && data.length > 0) {
        const catalog = data.map(row => ({
          id: row.id,
          capacityKW: Number(row.capacity_kw),
          modules: row.modules_spec,
          inverter: row.inverter_spec,
          dcWire: row.dc_wire,
          acWire: row.ac_wire,
          earthingWire: row.earthing_wire,
          laWire: row.la_wire,
          acdb: row.acdb,
          dcdb: row.dcdb,
          earthingKit: row.earthing_kit,
          pvcPipes: row.pvc_pipes,
          hardware: row.hardware || 'Including',
          mc4: row.mc4_pairs
        }));
        localStorage.setItem(BOM_CATALOG_KEY, JSON.stringify(catalog));
        return catalog;
      }
    } catch (err) {
      console.warn('Supabase fetch BOM catalog fallback:', err);
    }

    try {
      const cached = localStorage.getItem(BOM_CATALOG_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  },

  async saveBomCatalog(catalog) {
    if (!Array.isArray(catalog) || catalog.length === 0) {
      return { success: false, error: 'Valid BOM catalog required' };
    }

    try {
      localStorage.setItem(BOM_CATALOG_KEY, JSON.stringify(catalog));
    } catch (_) {}

    try {
      const rows = catalog.map((item, idx) => ({
        id: item.id || `bom-${String(item.capacityKW).replace('.', '_')}`,
        capacity_kw: Number(item.capacityKW) || 3.0,
        modules_spec: item.modules || '',
        inverter_spec: item.inverter || '',
        dc_wire: item.dcWire || '',
        ac_wire: item.acWire || '',
        earthing_wire: item.earthingWire || '',
        la_wire: item.laWire || '',
        acdb: item.acdb || '',
        dcdb: item.dcdb || '',
        earthing_kit: item.earthingKit || '',
        pvc_pipes: item.pvcPipes || '',
        hardware: item.hardware || 'Including',
        mc4_pairs: item.mc4 || '',
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('bom_catalog')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase save BOM catalog notice:', error.message);
        return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database: ' + error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database. Check your connection.' };
    }
  },

  // ==========================================
  // 5. DEALER TIER MARGINS
  // ==========================================
  async getTierMargins() {
    try {
      const { data, error } = await supabase
        .from('dealer_custom_pricing')
        .select('*');

      if (!error && data && data.length > 0) {
        const tiers = {};
        data.forEach(row => {
          tiers[row.tier_id] = {
            tierName: row.tier_name,
            defaultMarginPerKw: Number(row.default_margin_per_kw),
            maxMarginCapPerKw: Number(row.max_margin_cap_per_kw),
            description: row.description
          };
        });
        localStorage.setItem(TIER_MARGINS_KEY, JSON.stringify(tiers));
        return tiers;
      }
    } catch (err) {
      console.warn('Supabase fetch tier margins fallback:', err);
    }

    try {
      const cached = localStorage.getItem(TIER_MARGINS_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  },

  async saveTierMargins(tiers) {
    if (!tiers || typeof tiers !== 'object') return { success: false, error: 'Tiers required' };

    try {
      localStorage.setItem(TIER_MARGINS_KEY, JSON.stringify(tiers));
    } catch (_) {}

    try {
      const rows = Object.entries(tiers).map(([tierId, config]) => ({
        tier_id: tierId,
        tier_name: config.tierName || tierId,
        default_margin_per_kw: Number(config.defaultMarginPerKw) || 4000,
        max_margin_cap_per_kw: Number(config.maxMarginCapPerKw) || 6000,
        description: config.description || '',
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('dealer_custom_pricing')
        .upsert(rows, { onConflict: 'tier_id' });

      if (error) {
        console.warn('Supabase save tier margins notice:', error.message);
        return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database: ' + error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database. Check your connection.' };
    }
  },

  // ==========================================
  // 6. DEALER CUSTOM PRICINGS
  // ==========================================
  async getAllDealerPricings() {
    try {
      const cached = localStorage.getItem(DEALER_PRICING_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (_) {
      return {};
    }
  },

  async saveDealerPricing(dealerId, dealerCode, salespersonId, pricingData) {
    if (!dealerId) return { success: false, error: 'Dealer ID required' };
    try {
      const cached = JSON.parse(localStorage.getItem(DEALER_PRICING_KEY) || '{}');
      cached[dealerId] = pricingData;
      localStorage.setItem(DEALER_PRICING_KEY, JSON.stringify(cached));
    } catch (_) {}

    try {
      const targetIdentifier = dealerCode || dealerId;
      const { error } = await supabase
        .from('dealer_accounts')
        .update({
          pricing_config: pricingData,
          updated_at: new Date().toISOString()
        })
        .or(`dealer_code.eq.${targetIdentifier},id.eq.${targetIdentifier}`);

      if (error) {
        console.warn('Supabase save dealer pricing notice:', error.message);
        return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database: ' + error.message };
      }
      return { success: true, data: pricingData };
    } catch (err) {
      return { success: false, localOnly: true, error: 'Changes saved locally but could not sync to database. Check your connection.' };
    }
  }
};

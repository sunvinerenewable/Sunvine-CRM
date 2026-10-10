import { supabase } from '../lib/supabase';

async function invalidateCatalogCache(keys) {
  try {
    await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
        return {
          baseRatePerKw: Number(data.base_rate_per_kw) || 59800,
          subsidyCap: Number(data.subsidy_cap) || 78000,
          minMarginPerKw: Number(data.min_margin_per_kw) || 4000,
          enforceMinMargin: data.enforce_min_margin !== false,
          lastSynced: data.updated_at ? new Date(data.updated_at).toLocaleDateString() : 'Active',
          updatedBy: data.last_synced_by || 'Operations Desk'
        };
      }
    } catch (err) {
      console.warn('Supabase fetch pricing presets fallback:', err);
    }

    return null;
  },

  async savePricingPresets(presets) {
    if (!presets) return { success: false, error: 'Presets required' };

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
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
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
        return data.map(row => ({
          capacityKW: Number(row.capacity_kw),
          noOfModules: Number(row.no_of_modules),
          inverterCapacityKW: row.inverter_capacity_kw,
          adaniBiFiPrice: Number(row.adani_bifi_price),
          apsBiFiPrice: Number(row.aps_bifi_price),
          rayzonePrice: Number(row.rayzone_price),
          waaree540Price: Number(row.waaree_540_price) || 0,
          topcon585CapacityKW: Number(row.topcon585_capacity_kw) || (Number(row.capacity_kw) * 1.06),
          waaree585Price: Number(row.waaree_585_price) || 0,
          topcon600CapacityKW: Number(row.topcon600_capacity_kw) || (Number(row.capacity_kw) * 1.09),
          apsTopcon600Price: Number(row.aps_topcon_600_price) || 0,
          panelPrices: row.panel_prices || {}
        }));
      }
    } catch (err) {
      console.warn('Supabase fetch BOS matrix fallback:', err);
    }

    return null;
  },

  async saveBosMatrix(matrixList) {
    if (!Array.isArray(matrixList) || matrixList.length === 0) {
      return { success: false, error: 'Valid matrix list required' };
    }

    try {
      const rows = matrixList.map((item) => ({
        id: `bos-${String(item.capacityKW).replace('.', '_')}`,
        capacity_kw: Number(item.capacityKW),
        no_of_modules: Number(item.noOfModules) || 2,
        inverter_capacity_kw: String(item.inverterCapacityKW || item.capacityKW),
        adani_bifi_price: Number(item.adaniBiFiPrice) || 0,
        aps_bifi_price: Number(item.apsBiFiPrice) || 0,
        rayzone_price: Number(item.rayzonePrice) || 0,
        waaree_540_price: Number(item.waaree540Price) || 0,
        topcon585_capacity_kw: Number(item.topcon585CapacityKW) || Number(item.capacityKW),
        waaree_585_price: Number(item.waaree585Price) || 0,
        topcon600_capacity_kw: Number(item.topcon600CapacityKW) || Number(item.capacityKW),
        aps_topcon_600_price: Number(item.apsTopcon600Price) || 0,
        panel_prices: item.panelPrices || {},
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('bos_pricing_matrix')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase save BOS matrix notice:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
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
          return json.inverterBenchmarks.map(row => ({
            capacityKW: Number(row.capacity_kw),
            brand: row.brand,
            series: row.series,
            phase: row.phase,
            benchmarkPrice: Number(row.benchmark_price)
          }));
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
        return data.map(row => ({
          capacityKW: Number(row.capacity_kw),
          brand: row.brand,
          series: row.series,
          phase: row.phase,
          benchmarkPrice: Number(row.benchmark_price)
        }));
      }
    } catch (err) {
      console.warn('Supabase fetch inverter benchmarks fallback:', err);
    }

    return null;
  },

  async saveInverterBenchmarks(benchmarks) {
    if (!Array.isArray(benchmarks) || benchmarks.length === 0) {
      return { success: false, error: 'Valid benchmarks required' };
    }

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
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
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
        return data.map(row => ({
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
      }
    } catch (err) {
      console.warn('Supabase fetch BOM catalog fallback:', err);
    }

    return null;
  },

  async saveBomCatalog(catalog) {
    if (!Array.isArray(catalog) || catalog.length === 0) {
      return { success: false, error: 'Valid BOM catalog required' };
    }

    try {
      const rows = catalog.map((item) => ({
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
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
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
        return tiers;
      }
    } catch (err) {
      console.warn('Supabase fetch tier margins fallback:', err);
    }

    return null;
  },

  async saveTierMargins(tiers) {
    if (!tiers || typeof tiers !== 'object') return { success: false, error: 'Tiers required' };

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
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ==========================================
  // 6. DEALER CUSTOM PRICINGS
  // ==========================================
  async getAllDealerPricings() {
    try {
      const { data, error } = await supabase
        .from('dealer_accounts')
        .select('id, dealer_code, pricing_config');

      if (!error && data && data.length > 0) {
        const pricingMap = {};
        data.forEach(row => {
          if (row.pricing_config && Object.keys(row.pricing_config).length > 0) {
            if (row.id) pricingMap[row.id] = row.pricing_config;
            if (row.dealer_code) pricingMap[row.dealer_code] = row.pricing_config;
          }
        });
        return pricingMap;
      }
    } catch (err) {
      console.warn('Supabase fetch dealer pricings notice:', err);
    }

    return {};
  },

  async saveDealerPricing(dealerId, dealerCode, salespersonId, pricingData) {
    if (!dealerId) return { success: false, error: 'Dealer ID required' };

    try {
      const targetIdentifier = dealerCode || dealerId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetIdentifier || ''));
      let query = supabase
        .from('dealer_accounts')
        .update({
          pricing_config: pricingData,
          updated_at: new Date().toISOString()
        });

      if (isUuid) {
        query = query.eq('id', targetIdentifier);
      } else {
        query = query.eq('dealer_code', targetIdentifier);
      }

      const { error } = await query;

      if (error) {
        console.warn('Supabase save dealer pricing notice:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data: pricingData };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ==========================================
  // 7. SOLAR KIT PRESETS
  // ==========================================
  async getKitsPresets() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('terms_and_warranties')
        .eq('id', 'global_settings')
        .maybeSingle();

      if (!error && data?.terms_and_warranties?.solarKits) {
        return data.terms_and_warranties.solarKits;
      }
    } catch (err) {
      console.warn('Supabase fetch kit presets fallback:', err);
    }
    return [];
  },

  async saveKitPreset(newKit) {
    if (!newKit || !newKit.id) return { success: false, error: 'Kit required' };
    try {
      const { data: curr } = await supabase
        .from('system_settings')
        .select('terms_and_warranties')
        .eq('id', 'global_settings')
        .maybeSingle();

      const tw = curr?.terms_and_warranties || {};
      const existingKits = Array.isArray(tw.solarKits) ? tw.solarKits : [];
      const idx = existingKits.findIndex(k => k.id === newKit.id);
      if (idx >= 0) {
        existingKits[idx] = newKit;
      } else {
        existingKits.unshift(newKit);
      }
      tw.solarKits = existingKits;

      const { data, error } = await supabase
        .from('system_settings')
        .upsert([{
          id: 'global_settings',
          terms_and_warranties: tw,
          updated_at: new Date().toISOString()
        }], { onConflict: 'id' });

      if (error) return { success: false, error: error.message };
      return { success: true, data: newKit };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async deleteKitPreset(kitId) {
    if (!kitId) return { success: false };
    try {
      const { data: curr } = await supabase
        .from('system_settings')
        .select('terms_and_warranties')
        .eq('id', 'global_settings')
        .maybeSingle();

      const tw = curr?.terms_and_warranties || {};
      if (Array.isArray(tw.solarKits)) {
        tw.solarKits = tw.solarKits.filter(k => k.id !== kitId);
        await supabase
          .from('system_settings')
          .update({ terms_and_warranties: tw, updated_at: new Date().toISOString() })
          .eq('id', 'global_settings');
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

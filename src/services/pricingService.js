import { supabase } from '../lib/supabase.js';

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
    // 1. Fast Cache-Aside via serverless /api/catalog or /api/auth/admin-pricing
    try {
      const res = await fetch('/api/catalog?type=presets');
      if (res.ok) {
        const json = await res.json();
        if (json?.presets) {
          return json.presets;
        }
      }
    } catch (_) {}

    // 2. Try admin pricing endpoint
    try {
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'get-presets' })
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json.presets) return json.presets;
      }
    } catch (_) {}

    // 3. Direct read-only Supabase Query Fallback
    try {
      const { data, error } = await supabase
        .from('pricing_presets')
        .select('*')
        .eq('id', 'global_default')
        .single();

      if (!error && data) {
        return {
          baseRatePerKw: Number(data.base_rate_per_kw) || 0,
          subsidyCap: Number(data.subsidy_cap) || 0,
          minMarginPerKw: Number(data.min_margin_per_kw) || 0,
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
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-presets',
          presets: {
            baseRatePerKw: Number(presets.baseRatePerKw) || 0,
            subsidyCap: Number(presets.subsidyCap) || 0,
            minMarginPerKw: Number(presets.minMarginPerKw) || 0,
            enforceMinMargin: presets.enforceMinMargin !== false,
            updatedBy: presets.updatedBy || 'Operations Desk'
          }
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.success) {
          invalidateCatalogCache(['pricing:global_presets', 'catalog:presets', 'catalog:all']);
          return { success: true, data: json };
        }
      }

      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `HTTP ${res.status}: Failed to save pricing presets.` };
    } catch (err) {
      console.error('[pricingService] savePricingPresets exception:', err);
      return { success: false, error: err.message };
    }
  },

  // ==========================================
  // 2. BOS PRICING MATRIX
  // ==========================================
  async getBosMatrix() {
    try {
      const res = await fetch('/api/catalog?type=bos');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.bosMatrix) && json.bosMatrix.length > 0) {
          return json.bosMatrix;
        }
      }
    } catch (_) {}

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
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-bos',
          items: matrixList
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.success) {
          invalidateCatalogCache(['catalog:bos', 'catalog:all']);
          return { success: true, data: json };
        }
      }

      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `HTTP ${res.status}: Failed to save BOS matrix.` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async deleteBosSlab(capacityKwOrId) {
    try {
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'delete-bos-slab',
          id: capacityKwOrId
        })
      });
      if (res.ok) {
        invalidateCatalogCache(['catalog:bos', 'catalog:all']);
        return { success: true };
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
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-inverter-benchmarks',
          benchmarks
        })
      });

      if (res.ok) {
        invalidateCatalogCache(['catalog:inverter_benchmarks', 'catalog:all']);
        return { success: true };
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to save benchmarks' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async deleteInverterBenchmark(idOrCapacity) {
    try {
      await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'delete-inverter-benchmark', id: idOrCapacity })
      }).catch(() => {});
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
      const res = await fetch('/api/catalog?type=bom');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.bomItems) && json.bomItems.length > 0) {
          return json.bomItems;
        }
      }
    } catch (_) {}

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
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-bom-catalog',
          items: catalog
        })
      });

      if (res.ok) {
        invalidateCatalogCache(['catalog:bom', 'catalog:all']);
        return { success: true };
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to save BOM catalog' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ==========================================
  // 5. DEALER TIER MARGINS
  // ==========================================
  async getTierMargins() {
    try {
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'get-tier-margins' })
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json.tierMargins) return json.tierMargins;
      }
    } catch (_) {}

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
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-tier-margins',
          tiers
        })
      });

      if (res.ok) {
        invalidateCatalogCache(['catalog:tier-margins', 'dealer:rates:*', 'catalog:all']);
        return { success: true };
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to save tier margins' };
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
      let actualData = pricingData;
      let targetIdentifier = dealerCode || dealerId;

      // Handle 2-argument signature: saveDealerPricing(dealerId, pricingConfig)
      if (typeof dealerCode === 'object' && dealerCode !== null && !pricingData) {
        actualData = dealerCode;
        targetIdentifier = dealerId;
      }

      if (!actualData) {
        return { success: false, error: 'Pricing data required' };
      }

      // 1. Try server-side API handler
      try {
        const res = await fetch('/api/auth/admin-dealers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            op: 'upsert',
            dealer: {
              dealerCode: targetIdentifier,
              pricingConfig: actualData
            }
          })
        });

        if (res.ok) {
          invalidateCatalogCache([`dealer:rates:${targetIdentifier}`, 'catalog:all']);
        }
      } catch (_) {}

      // 2. Direct Supabase update for immediate consistency across tables
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetIdentifier || ''));
      
      let query = supabase
        .from('dealer_accounts')
        .update({
          pricing_config: actualData,
          updated_at: new Date().toISOString()
        });

      if (isUuid) {
        query = query.eq('id', targetIdentifier);
      } else {
        query = query.eq('dealer_code', targetIdentifier);
      }

      await query;

      // Also sync to dealers table if exists
      try {
        let dQuery = supabase
          .from('dealers')
          .update({
            pricing_config: actualData,
            updated_at: new Date().toISOString()
          });
        if (isUuid) {
          dQuery = dQuery.eq('id', targetIdentifier);
        } else {
          dQuery = dQuery.eq('dealer_code', targetIdentifier);
        }
        await dQuery;
      } catch (_) {}

      invalidateCatalogCache([`dealer:rates:${targetIdentifier}`, 'catalog:all']);
      return { success: true, data: actualData };
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
      const res = await fetch('/api/auth/admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert',
          section: 'solar_kits',
          values: newKit
        })
      });

      if (res.ok) {
        invalidateCatalogCache(['catalog:settings', 'catalog:all']);
        return { success: true, data: newKit };
      }
      return { success: true, data: newKit };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async deleteKitPreset(kitId) {
    if (!kitId) return { success: false };
    try {
      await fetch('/api/auth/admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'delete-kit-preset',
          id: kitId
        })
      }).catch(() => {});
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

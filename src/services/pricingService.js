import { supabase } from '../lib/supabase';

const DEALER_PRICING_KEY = 'sunvine_dealer_custom_pricing_v2';
const KITS_PRESETS_KEY = 'sunvine_solar_kits_presets_v2';

export const pricingService = {
  /**
   * Fetch all custom dealer pricings (Admin sees all, staff filtered if needed)
   */
  async getAllDealerPricings() {
    try {
      const { data, error } = await supabase
        .from('dealer_custom_pricing')
        .select('*');

      if (!error && data && data.length > 0) {
        const mapped = {};
        data.forEach(row => {
          mapped[row.dealer_id || row.dealer_code] = row.pricing_data;
        });
        localStorage.setItem(DEALER_PRICING_KEY, JSON.stringify(mapped));
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase fetch dealer pricing fallback:', err);
    }

    try {
      const cached = localStorage.getItem(DEALER_PRICING_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (_) {
      return {};
    }
  },

  /**
   * Save dealer custom pricing to Supabase and cache locally
   */
  async saveDealerPricing(dealerId, dealerCode, salespersonId, pricingData) {
    if (!dealerId) return { success: false, error: 'Dealer ID required' };

    // Support overloaded invocation: saveDealerPricing(dealerId, pricingConfig)
    if (typeof dealerCode === 'object' && dealerCode !== null && pricingData === undefined) {
      pricingData = dealerCode;
      dealerCode = dealerId;
      salespersonId = null;
    }

    // Update local cache first
    try {
      const cached = JSON.parse(localStorage.getItem(DEALER_PRICING_KEY) || '{}');
      cached[dealerId] = pricingData;
      if (dealerCode) cached[dealerCode] = pricingData;
      localStorage.setItem(DEALER_PRICING_KEY, JSON.stringify(cached));
    } catch (_) {}

    try {
      const payload = {
        dealer_id: dealerId,
        dealer_code: dealerCode || dealerId,
        salesperson_id: salespersonId || null,
        pricing_data: pricingData,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('dealer_custom_pricing')
        .upsert([payload], { onConflict: 'dealer_id' })
        .select();

      if (error) {
        console.warn('Supabase save dealer pricing notice:', error.message);
        return { success: true, localOnly: true, data: pricingData };
      }
      return { success: true, data };
    } catch (err) {
      return { success: true, localOnly: true, data: pricingData };
    }
  },

  /**
   * Fetch all saved BOM Kits & Presets
   */
  async getKitsPresets() {
    try {
      const { data, error } = await supabase
        .from('solar_kits_presets')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        localStorage.setItem(KITS_PRESETS_KEY, JSON.stringify(data));
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetch kits fallback:', err);
    }

    try {
      const cached = localStorage.getItem(KITS_PRESETS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  },

  /**
   * Save a reusable BOM Kit Preset to Supabase & localStorage
   */
  async saveKitPreset(kit) {
    if (!kit || !kit.name) return { success: false, error: 'Kit name required' };
    const kitId = kit.id || `kit-${Date.now()}`;
    const payload = {
      id: kitId,
      name: kit.name,
      capacity_kw: Number(kit.capacityKw) || 3.3,
      created_by: kit.createdBy || 'Admin',
      creator_role: kit.creatorRole || 'admin',
      items_json: kit.items || [],
      created_at: new Date().toISOString()
    };

    try {
      const cached = JSON.parse(localStorage.getItem(KITS_PRESETS_KEY) || '[]');
      const filtered = cached.filter(k => k.id !== kitId);
      localStorage.setItem(KITS_PRESETS_KEY, JSON.stringify([payload, ...filtered]));
    } catch (_) {}

    try {
      const { data, error } = await supabase
        .from('solar_kits_presets')
        .upsert([payload], { onConflict: 'id' })
        .select();

      if (error) {
        return { success: true, localOnly: true, data: payload };
      }
      return { success: true, data };
    } catch (err) {
      return { success: true, localOnly: true, data: payload };
    }
  },

  /**
   * Delete a Kit Preset
   */
  async deleteKitPreset(kitId) {
    try {
      const cached = JSON.parse(localStorage.getItem(KITS_PRESETS_KEY) || '[]');
      localStorage.setItem(KITS_PRESETS_KEY, JSON.stringify(cached.filter(k => k.id !== kitId)));
      await supabase.from('solar_kits_presets').delete().eq('id', kitId);
      return { success: true };
    } catch (err) {
      return { success: true };
    }
  }
};

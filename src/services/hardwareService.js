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

/**
 * Enterprise Hardware Service
 * Manages approved solar PV modules, string inverters, and BOM catalog via secure APIs
 */
export const hardwareService = {
  /**
   * Check connection status to Supabase (read-only probe)
   */
  async checkConnection() {
    try {
      const { data, error } = await supabase.from('solar_modules').select('id').limit(1);
      if (error) return { connected: false, error: error.message };
      return { connected: true };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  },

  /**
   * Fetch all solar modules
   */
  async getAllModules() {
    // 1. Try server API / catalog
    try {
      const res = await fetch('/api/catalog?type=hardware');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.modules) && json.modules.length > 0) {
          return json.modules;
        }
      }
    } catch (_) {}

    // 2. Try admin hardware endpoint
    try {
      const res = await fetch('/api/auth/admin-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'list-modules' })
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.modules)) {
          return json.modules;
        }
      }
    } catch (_) {}

    // 3. Direct read-only Supabase Query
    try {
      const { data, error } = await supabase
        .from('solar_modules')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(row => ({
          id: row.id,
          brand: row.brand,
          model: row.model,
          wattage: Number(row.wattage) || 550,
          cellTech: row.cell_tech || 'TOPCon Mono Bifacial',
          efficiency: row.efficiency || '22.6%',
          ratePerWp: row.rate_per_wp || '₹ 19.20/Wp',
          warranty: row.warranty || '30 Years Performance',
          dimensions: row.dimensions || '2278 × 1134 × 30 mm | 28 kg',
          isArchived: !!row.is_archived,
          isDefault: !!row.is_default,
          isNew: !!row.is_new,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
        }));
      }
    } catch (err) {
      console.warn('[hardwareService] Direct Supabase fetch notice:', err);
    }

    return [];
  },

  /**
   * Save or update a solar module via secure API
   */
  async saveModule(mod) {
    if (!mod || !mod.brand || !mod.model) {
      return { success: false, error: 'Brand and Model are required' };
    }

    const payload = {
      id: mod.id || `mod-${Date.now()}`,
      brand: mod.brand.trim(),
      model: mod.model.trim(),
      wattage: Number(mod.wattage) || 550,
      cell_tech: mod.cellTech || 'TOPCon Mono Bifacial',
      efficiency: mod.efficiency || '22.6%',
      rate_per_wp: mod.ratePerWp ? (String(mod.ratePerWp).startsWith('₹') ? mod.ratePerWp : `₹ ${mod.ratePerWp}/Wp`) : '₹ 19.20/Wp',
      warranty: mod.warranty || '30 Years Performance',
      dimensions: mod.dimensions || '2278 × 1134 × 30 mm | 28 kg',
      is_archived: !!mod.isArchived,
      is_default: !!mod.isDefault,
      is_new: mod.isNew !== undefined ? !!mod.isNew : false
    };

    try {
      const res = await fetch('/api/auth/admin-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-module',
          module: payload
        })
      });

      if (res.ok) {
        const json = await res.json();
        invalidateCatalogCache(['catalog:hardware', 'catalog:modules', 'catalog:all']);
        return { success: true, data: json?.module || payload };
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `Failed to save module (${res.status})` };
    } catch (err) {
      console.error('[hardwareService] saveModule exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Toggle archive state of a solar module via secure API
   */
  async archiveModule(moduleId, isArchived) {
    try {
      const res = await fetch('/api/auth/admin-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-module',
          module: {
            id: moduleId,
            is_archived: isArchived,
            is_active: !isArchived
          }
        })
      });

      invalidateCatalogCache(['catalog:hardware', 'catalog:modules', 'catalog:all']);
      if (res.ok) return { success: true };
      return { success: true };
    } catch (err) {
      console.error('[hardwareService] archiveModule exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete a solar module via secure API
   */
  async deleteModule(moduleId) {
    try {
      const res = await fetch('/api/auth/admin-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'delete-module',
          id: moduleId
        })
      });

      invalidateCatalogCache(['catalog:hardware', 'catalog:modules', 'catalog:all']);
      if (res.ok) return { success: true };
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to delete module' };
    } catch (err) {
      console.error('[hardwareService] deleteModule exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Bulk update rates for multiple modules via secure API
   */
  async bulkUpdateModulePrices(bulkRatesMap) {
    try {
      for (const [id, rate] of Object.entries(bulkRatesMap)) {
        await fetch('/api/auth/admin-hardware', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            op: 'upsert-module',
            module: {
              id,
              rate_per_wp: `₹ ${Number(rate).toFixed(2)}/Wp`
            }
          })
        }).catch(() => {});
      }
      invalidateCatalogCache(['catalog:hardware', 'catalog:modules', 'catalog:all']);
      return { success: true };
    } catch (err) {
      console.error('[hardwareService] bulkUpdateModulePrices error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Bulk import multiple solar modules via secure API
   */
  async bulkImportModules(modules) {
    if (!modules || modules.length === 0) return { success: true, count: 0 };

    try {
      let count = 0;
      for (let i = 0; i < modules.length; i++) {
        const mod = modules[i];
        const res = await fetch('/api/auth/admin-hardware', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            op: 'upsert-module',
            module: {
              id: mod.id || `mod-imp-${Date.now()}-${i}`,
              brand: mod.brand.trim(),
              model: mod.model.trim(),
              wattage: Number(mod.wattage) || 550,
              cell_tech: mod.cellTech || 'TOPCon Mono Bifacial',
              efficiency: mod.efficiency || '22.6%',
              rate_per_wp: mod.ratePerWp ? (String(mod.ratePerWp).startsWith('₹') ? mod.ratePerWp : `₹ ${mod.ratePerWp}/Wp`) : '₹ 19.50/Wp',
              warranty: mod.warranty || '30 Years Performance',
              dimensions: mod.dimensions || '2278 × 1134 × 30 mm | 28 kg',
              is_archived: false,
              is_default: false,
              is_new: true
            }
          })
        });
        if (res.ok) count++;
      }
      invalidateCatalogCache(['catalog:hardware', 'catalog:modules', 'catalog:all']);
      return { success: true, count };
    } catch (err) {
      console.error('[hardwareService] bulkImportModules exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch all string inverters
   */
  async getAllInverters() {
    try {
      const res = await fetch('/api/catalog?type=inverters');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.inverters) && json.inverters.length > 0) {
          return json.inverters;
        }
      }
    } catch (_) {}

    try {
      const res = await fetch('/api/auth/admin-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'list-inverters' })
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.inverters)) {
          return json.inverters;
        }
      }
    } catch (_) {}

    try {
      const { data, error } = await supabase
        .from('solar_inverters')
        .select('*')
        .order('capacity_kw', { ascending: true });

      if (!error && Array.isArray(data)) {
        return data.map(row => ({
          id: row.id,
          brand: row.brand,
          model: row.model,
          capacity: row.capacity || `${row.capacity_kw} kW`,
          capacityKW: Number(row.capacity_kw) || 5.0,
          phase: row.phase || 'Three Phase',
          efficiency: row.efficiency || '98.4%',
          warranty: row.warranty || '8 Years Comprehensive',
          basePrice: row.base_price || '₹ 54,000',
          isArchived: !!row.is_archived,
          isDefault: !!row.is_default,
          isNew: !!row.is_new,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
        }));
      }
    } catch (err) {
      console.warn('[hardwareService] Direct Supabase inverters fetch notice:', err);
    }

    return [];
  },

  /**
   * Save or update a string inverter via secure API
   */
  async saveInverter(inv) {
    if (!inv || !inv.brand || !inv.model) {
      return { success: false, error: 'Brand and Model are required' };
    }

    const rawCap = inv.capacity?.trim() || `${inv.capacityKW || 5.0} kW`;
    const formattedCap = rawCap.toLowerCase().includes('kw') ? rawCap : `${rawCap} kW`;
    const numCap = Number(inv.capacityKW) || parseFloat(rawCap.replace(/[^0-9.]/g, '')) || 5.0;

    const payload = {
      id: inv.id || `inv-${Date.now()}`,
      brand: inv.brand.trim(),
      model: inv.model.trim(),
      capacity: formattedCap,
      capacity_kw: numCap,
      phase: inv.phase || 'Three Phase',
      efficiency: inv.efficiency || '98.4%',
      warranty: inv.warranty || '8 Years Comprehensive',
      base_price: inv.basePrice || inv.base_price || '₹ 54,000',
      is_archived: !!inv.isArchived,
      is_default: !!inv.isDefault,
      is_new: inv.isNew !== undefined ? !!inv.isNew : false,
      updated_at: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/auth/admin-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-inverter',
          inverter: payload
        })
      });

      invalidateCatalogCache(['catalog:hardware', 'catalog:inverters', 'catalog:all']);
      if (res.ok) {
        const json = await res.json();
        return { success: true, data: json?.inverter || payload };
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to save inverter' };
    } catch (err) {
      console.error('[hardwareService] saveInverter exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Toggle archive state of an inverter via secure API
   */
  async archiveInverter(inverterId, isArchived) {
    try {
      const res = await fetch('/api/auth/admin-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-inverter',
          inverter: {
            id: inverterId,
            is_archived: isArchived,
            is_active: !isArchived
          }
        })
      });

      invalidateCatalogCache(['catalog:hardware', 'catalog:inverters', 'catalog:all']);
      if (res.ok) return { success: true };
      return { success: true };
    } catch (err) {
      console.error('[hardwareService] archiveInverter exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete an inverter via secure API
   */
  async deleteInverter(inverterId) {
    try {
      const res = await fetch('/api/auth/admin-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'delete-inverter',
          id: inverterId
        })
      });

      invalidateCatalogCache(['catalog:hardware', 'catalog:inverters', 'catalog:all']);
      if (res.ok) return { success: true };
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to delete inverter' };
    } catch (err) {
      console.error('[hardwareService] deleteInverter exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Seed Initial Modules and Inverters via secure API
   */
  async seedInitialHardwareIfEmpty(defaultModules, defaultInverters) {
    try {
      if (defaultModules?.length > 0) {
        for (const m of defaultModules) {
          await this.saveModule(m);
        }
      }
      if (defaultInverters?.length > 0) {
        for (const inv of defaultInverters) {
          await this.saveInverter(inv);
        }
      }
    } catch (err) {
      console.warn('[hardwareService] Seed notice:', err.message);
    }
  },

  /**
   * Fetch all Bill of Materials (BOM) Hardware Catalog Items
   */
  async getAllBomItems() {
    try {
      const { data, error } = await supabase
        .from('bom_catalog')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.warn('[hardwareService] Supabase bom_catalog fetch error:', error.message);
        return [];
      }

      if (Array.isArray(data)) {
        return data
          .filter(row => !row.id.startsWith('bom-') || row.inverter_spec?.match(/structure|electrical|cables|conduits|safety/i))
          .map(row => {
            const rawRate = Number(row.capacity_kw) || 0;
            return {
              id: row.id,
              name: row.modules_spec || row.id,
              category: row.inverter_spec || 'structure',
              description: row.dc_wire || '',
              unit: row.ac_wire || 'Nos',
              defaultRate: rawRate,
              rate: rawRate,
              make: row.hardware || 'Approved Make',
              specs: row.earthing_wire || '',
              gstRate: Number(row.la_wire) || 18,
              isArchived: row.acdb === 'archived',
              updatedAt: row.updated_at
            };
          });
      }

      return [];
    } catch (err) {
      console.error('[hardwareService] getAllBomItems exception:', err);
      return [];
    }
  },

  /**
   * Save or update a BOM hardware item via secure API
   */
  async saveBomItem(item) {
    if (!item || !item.name) {
      return { success: false, error: 'Item name is required' };
    }

    const parsedRate = item.defaultRate !== undefined && item.defaultRate !== null && !isNaN(Number(item.defaultRate))
      ? Number(item.defaultRate)
      : (item.rate !== undefined && item.rate !== null && !isNaN(Number(item.rate)) ? Number(item.rate) : 100);

    const payload = {
      id: item.id || `bom_hw_${Date.now()}`,
      category: item.category || 'structure',
      item_name: item.name.trim(),
      description: item.description || '',
      unit: item.unit || 'Nos',
      default_rate: parsedRate,
      gst_rate: Number(item.gstRate !== undefined ? item.gstRate : 18),
      is_active: !item.isArchived
    };

    try {
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-bom',
          item: payload
        })
      });

      invalidateCatalogCache(['catalog:bom', 'catalog:all']);

      return {
        success: true,
        data: {
          id: payload.id,
          name: payload.item_name,
          category: payload.category,
          description: payload.description,
          unit: payload.unit,
          defaultRate: payload.default_rate,
          gstRate: payload.gst_rate,
          isArchived: !payload.is_active
        }
      };
    } catch (err) {
      console.error('[hardwareService] saveBomItem exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete a BOM hardware item via secure API
   */
  async deleteBomItem(itemId) {
    if (!itemId) return { success: false, error: 'Item ID is required' };
    try {
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'delete-bom',
          id: itemId
        })
      });

      invalidateCatalogCache(['catalog:bom', 'catalog:all']);
      return { success: true };
    } catch (err) {
      console.error('[hardwareService] deleteBomItem exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Toggle archive status of a BOM hardware item via secure API
   */
  async archiveBomItem(itemId, isArchived) {
    if (!itemId) return { success: false, error: 'Item ID is required' };
    try {
      await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-bom',
          item: { id: itemId, is_active: !isArchived }
        })
      }).catch(() => {});

      invalidateCatalogCache(['catalog:bom', 'catalog:all']);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Bulk update benchmark rates for BOM hardware items via secure API
   */
  async bulkUpdateBomRates(ratesMap) {
    try {
      for (const [id, rate] of Object.entries(ratesMap)) {
        await fetch('/api/auth/admin-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            op: 'upsert-bom',
            item: { id, default_rate: Number(rate) || 0 }
          })
        }).catch(() => {});
      }
      invalidateCatalogCache(['catalog:bom', 'catalog:all']);
      return { success: true };
    } catch (err) {
      console.error('[hardwareService] bulkUpdateBomRates error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Bulk import multiple BOM hardware items via secure API
   */
  async bulkImportBomItems(items) {
    if (!items || items.length === 0) return { success: true, count: 0 };

    try {
      let count = 0;
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const parsedRate = it.defaultRate !== undefined && it.defaultRate !== null && !isNaN(Number(it.defaultRate))
          ? Number(it.defaultRate)
          : (it.rate !== undefined && it.rate !== null && !isNaN(Number(it.rate)) ? Number(it.rate) : 100);

        await fetch('/api/auth/admin-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            op: 'upsert-bom',
            item: {
              id: it.id || `bom_imp_${Date.now()}_${idx}`,
              category: it.category || 'structure',
              item_name: (it.name || it.description || 'Hardware Item').trim(),
              description: it.description || it.specs || '',
              unit: it.unit || 'Nos',
              default_rate: parsedRate,
              gst_rate: Number(it.gstRate !== undefined ? it.gstRate : 18),
              is_active: !it.isArchived
            }
          })
        }).catch(() => {});
        count++;
      }
      invalidateCatalogCache(['catalog:bom', 'catalog:all']);
      return { success: true, count };
    } catch (err) {
      console.error('[hardwareService] bulkImportBomItems exception:', err);
      return { success: false, error: err.message };
    }
  }
};

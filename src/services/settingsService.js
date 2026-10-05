import { supabase } from '../lib/supabase';
import { MASTER_DOCUMENTATION_POLICIES } from '../data/documentationPolicies';

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

export const settingsService = {
  /**
   * Fetch Master System Settings (Company Profile, Bank Details, Terms, Tax, Governance, Documentation Policies)
   * Stored and retrieved directly from persistent Supabase backend database
   */
  async getSystemSettings() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'global_settings')
        .maybeSingle();

      if (error || !data) {
        console.warn('[settingsService] Fallback reading system settings:', error?.message);
        return {
          companyProfile: {},
          bankDetails: {},
          termsAndWarranties: {},
          documentPolicies: MASTER_DOCUMENTATION_POLICIES,
          statutoryTaxes: {},
          governanceSettings: {}
        };
      }

      const terms = data.terms_and_warranties || {};
      const documentPolicies = terms.documentPolicies || terms.policies || data.document_policies || MASTER_DOCUMENTATION_POLICIES;

      return {
        companyProfile: data.company_profile || {},
        bankDetails: data.bank_details || {},
        termsAndWarranties: terms,
        documentPolicies,
        statutoryTaxes: data.statutory_taxes || {},
        governanceSettings: data.governance_settings || {}
      };
    } catch (err) {
      console.error('[settingsService] Get settings error:', err);
      return null;
    }
  },

  /**
   * Save / Update a specific section in system_settings directly in Supabase
   */
  async saveSystemSettings(sectionKey, sectionData) {
    try {
      if (sectionKey === 'documentPolicies') {
        const { data: curr } = await supabase
          .from('system_settings')
          .select('terms_and_warranties')
          .eq('id', 'global_settings')
          .single();
        const tw = curr?.terms_and_warranties || {};
        tw.documentPolicies = sectionData;
        const { data, error } = await supabase
          .from('system_settings')
          .update({
            terms_and_warranties: tw,
            updated_at: new Date().toISOString()
          })
          .eq('id', 'global_settings')
          .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data?.[0] };
      }

      const colMap = {
        companyProfile: 'company_profile',
        bankDetails: 'bank_details',
        termsAndWarranties: 'terms_and_warranties',
        statutoryTaxes: 'statutory_taxes',
        governanceSettings: 'governance_settings'
      };

      const dbCol = colMap[sectionKey] || sectionKey;

      const { data, error } = await supabase
        .from('system_settings')
        .update({
          [dbCol]: sectionData,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global_settings')
        .select();

      if (error) {
        console.warn('[settingsService] Update warning:', error.message);
        return { success: false, error: error.message };
      }

      invalidateCatalogCache(['settings:global']);
      return { success: true, data: data?.[0] };
    } catch (err) {
      console.error('[settingsService] Update error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch Pricing Presets, Tier Margins & BOM Presets from Supabase Database
   */
  async getPricingPresets() {
    try {
      const { data, error } = await supabase
        .from('pricing_presets')
        .select('*')
        .eq('id', 'global_default')
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const tierMarginsObj = data.tier_margins || {};

      return {
        baseRatePerKw: Number(data.base_rate_per_kw) || 59800,
        subsidyCap: Number(data.subsidy_cap) || 78000,
        minMarginPerKw: Number(data.min_margin_per_kw) || 4000,
        enforceMinMargin: data.enforce_min_margin !== false,
        lastSynced: data.last_synced_by ? `Synced by ${data.last_synced_by}` : 'Synced with Database',
        tierMargins: tierMarginsObj.tiers || tierMarginsObj,
        bomRates: tierMarginsObj.bomRates || null,
        capacityBomMatrix: tierMarginsObj.capacityBomMatrix || null,
        inverterBenchmarkMatrix: tierMarginsObj.inverterBenchmarkMatrix || null,
        baseRates: tierMarginsObj.baseRates || null
      };
    } catch (err) {
      console.error('[settingsService] Get pricing error:', err);
      return null;
    }
  },

  /**
   * Save Pricing Presets directly to Supabase Database
   */
  async savePricingPresets(presets) {
    try {
      // Fetch current tier_margins JSON to preserve sub-objects
      const { data: curr } = await supabase
        .from('pricing_presets')
        .select('tier_margins')
        .eq('id', 'global_default')
        .maybeSingle();

      const existingTierMargins = curr?.tier_margins || {};

      const updatedTierMargins = {
        ...existingTierMargins,
        tiers: presets.tierMargins || existingTierMargins.tiers || existingTierMargins
      };

      if (presets.bomRates !== undefined) updatedTierMargins.bomRates = presets.bomRates;
      if (presets.capacityBomMatrix !== undefined) updatedTierMargins.capacityBomMatrix = presets.capacityBomMatrix;
      if (presets.inverterBenchmarkMatrix !== undefined) updatedTierMargins.inverterBenchmarkMatrix = presets.inverterBenchmarkMatrix;
      if (presets.baseRates !== undefined) updatedTierMargins.baseRates = presets.baseRates;

      const payload = {
        updated_at: new Date().toISOString(),
        tier_margins: updatedTierMargins
      };

      if (presets.baseRatePerKw !== undefined) payload.base_rate_per_kw = Number(presets.baseRatePerKw);
      if (presets.subsidyCap !== undefined) payload.subsidy_cap = Number(presets.subsidyCap);
      if (presets.minMarginPerKw !== undefined) payload.min_margin_per_kw = Number(presets.minMarginPerKw);
      if (presets.enforceMinMargin !== undefined) payload.enforce_min_margin = Boolean(presets.enforceMinMargin);
      if (presets.updatedBy !== undefined) payload.last_synced_by = presets.updatedBy;

      const { data, error } = await supabase
        .from('pricing_presets')
        .update(payload)
        .eq('id', 'global_default')
        .select();

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, data: data?.[0] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Save BOS Price Matrix to Supabase Database
   */
  async saveBosPriceMatrix(matrixRows) {
    if (!Array.isArray(matrixRows) || matrixRows.length === 0) return { success: true };
    try {
      const payloads = matrixRows.map(r => ({
        id: r.id || `bos-${String(r.capacityKW).replace('.', '_')}`,
        capacity_kw: Number(r.capacityKW),
        no_of_modules: Number(r.noOfModules),
        inverter_capacity_kw: String(r.inverterCapacityKW || r.capacityKW),
        adani_bifi_price: Number(r.adaniBiFiPrice) || 0,
        aps_bifi_price: Number(r.apsBiFiPrice) || 0,
        rayzone_price: Number(r.rayzonePrice) || 0,
        topcon585_capacity_kw: Number(r.topcon585CapacityKW) || 0,
        waaree_585_price: Number(r.waaree585Price) || 0,
        topcon600_capacity_kw: Number(r.topcon600CapacityKW) || 0,
        aps_topcon_600_price: Number(r.apsTopcon600Price) || 0,
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('bos_pricing_matrix')
        .upsert(payloads, { onConflict: 'id' })
        .select();

      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch BOS Price Matrix from Database
   */
  async getBosPriceMatrix() {
    try {
      const { data, error } = await supabase
        .from('bos_pricing_matrix')
        .select('*')
        .order('capacity_kw', { ascending: true });

      if (error || !data || data.length === 0) {
        return null;
      }

      return data.map(r => ({
        capacityKW: Number(r.capacity_kw),
        noOfModules: Number(r.no_of_modules),
        inverterCapacityKW: Number(r.inverter_capacity_kw) || r.inverter_capacity_kw,
        adaniBiFiPrice: Number(r.adani_bifi_price),
        apsBiFiPrice: Number(r.aps_bifi_price),
        rayzonePrice: Number(r.rayzone_price),
        topcon585CapacityKW: Number(r.topcon585_capacity_kw),
        waaree585Price: Number(r.waaree_585_price),
        topcon600CapacityKW: Number(r.topcon600_capacity_kw),
        apsTopcon600Price: Number(r.aps_topcon_600_price)
      }));
    } catch (err) {
      console.error('[settingsService] Fetch BOS matrix error:', err);
      return null;
    }
  },

  /**
   * Fetch BOM Catalog from Database
   */
  async getBomCatalog() {
    try {
      const { data, error } = await supabase
        .from('bom_catalog')
        .select('*')
        .order('id', { ascending: true });

      if (error || !data || data.length === 0) {
        return null;
      }

      return data.map(item => ({
        id: item.id,
        capacityKW: Number(item.capacity_kw) || 3.3,
        name: item.modules_spec,
        modulesSpec: item.modules_spec,
        inverterSpec: item.inverter_spec,
        category: item.inverter_spec,
        dcWire: item.dc_wire,
        acWire: item.ac_wire,
        earthingWire: item.earthing_wire,
        laWire: item.la_wire,
        acdb: item.acdb,
        dcdb: item.dcdb,
        earthingKit: item.earthing_kit,
        pvcPipes: item.pvc_pipes,
        hardware: item.hardware,
        mc4Pairs: item.mc4_pairs
      }));
    } catch (err) {
      console.error('[settingsService] Fetch BOM catalog error:', err);
      return null;
    }
  },

  /**
   * Fetch Audit Logs from Database
   */
  async getAuditLogs(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[settingsService] Failed to fetch audit logs:', error.message, error.code, error.hint);
        return [];
      }
      if (!data) return [];
      return data.map(log => ({
        id: log.id,
        timestamp: log.created_at || log.timestamp || new Date().toISOString(),
        action: log.action || 'SYSTEM_ACTION',
        module: log.module || log.entity_type || 'SYSTEM',
        recordId: log.record_id || log.entity_id || '-',
        userId: log.user_id || 'ADM-001',
        userName: log.user_name || log.user_email || 'Super Admin Desk',
        role: log.role || log.user_role || 'System Administrator',
        details: typeof log.details === 'object' && log.details !== null
          ? (log.details.message || JSON.stringify(log.details))
          : (log.details || ''),
        oldValue: log.old_value,
        newValue: log.new_value,
        ipAddress: log.ip_address,
        status: log.status || 'VERIFIED'
      }));
    } catch (err) {
      console.warn('[settingsService] Exception fetching audit logs:', err);
      return [];
    }
  },

  /**
   * Insert Immutable Audit Log to Database
   */
  async logActivity(logEntry) {
    if (!logEntry) return;

    // Ensure jsonb details is a valid object
    let detailsObj = {};
    if (typeof logEntry.details === 'object' && logEntry.details !== null) {
      detailsObj = logEntry.details;
    } else if (typeof logEntry.details === 'string' && logEntry.details.trim()) {
      detailsObj = { message: logEntry.details.trim() };
    }

    // Ensure jsonb old_value and new_value are valid objects or null
    const oldValueObj = (logEntry.oldValue && typeof logEntry.oldValue === 'object') ? logEntry.oldValue : null;
    const newValueObj = (logEntry.newValue && typeof logEntry.newValue === 'object') ? logEntry.newValue : null;

    // Ensure ip_address is a clean string or null (never invalid/empty string)
    const cleanIp = (logEntry.ipAddress && typeof logEntry.ipAddress === 'string' && logEntry.ipAddress.trim())
      ? logEntry.ipAddress.trim()
      : null;

    // Do NOT send client-generated string id or timestamp; let DB defaults gen_random_uuid() and timezone('utc', now()) handle them
    const payload = {
      action: logEntry.action || 'SYSTEM_ACTION',
      module: logEntry.module || 'SYSTEM',
      entity_type: logEntry.module || 'SYSTEM',
      record_id: logEntry.recordId ? String(logEntry.recordId) : null,
      entity_id: logEntry.recordId ? String(logEntry.recordId) : null,
      user_id: logEntry.userId ? String(logEntry.userId) : 'ADM-001',
      user_name: logEntry.userName || 'Super Admin Desk',
      user_email: logEntry.userName || 'admin@sunvine.in',
      role: logEntry.role || 'System Administrator',
      user_role: logEntry.role || 'admin',
      details: detailsObj,
      old_value: oldValueObj,
      new_value: newValueObj,
      ip_address: cleanIp,
      status: logEntry.status || 'VERIFIED'
    };

    try {
      const { error } = await supabase.from('audit_logs').insert([payload]);
      if (error) {
        console.error('[settingsService] Supabase audit log insert error:', {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details
        });
      }
    } catch (err) {
      console.error('[settingsService] Failed to insert audit log:', err);
    }
  }
};

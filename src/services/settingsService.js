import { supabase } from '../lib/supabase.js';
import { MASTER_DOCUMENTATION_POLICIES } from '../data/documentationPolicies.js';

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
   */
  async getSystemSettings() {
    // 1. Try secure admin settings endpoint or catalog
    try {
      const res = await fetch('/api/auth/admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'get' })
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json.settings) {
          const s = json.settings;
          const terms = s.terms_and_warranties || {};
          const documentPolicies = terms.documentPolicies || terms.policies || s.document_policies || MASTER_DOCUMENTATION_POLICIES;
          return {
            companyProfile: s.company_profile || {},
            bankDetails: s.bank_details || {},
            termsAndWarranties: terms,
            documentPolicies,
            statutoryTaxes: s.statutory_taxes || {},
            governanceSettings: s.governance_settings || {}
          };
        }
      }
    } catch (_) {}

    // 2. Direct read-only Supabase Query
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
   * Save / Update a specific section in system_settings via secure API
   */
  async saveSystemSettings(sectionKey, sectionData) {
    const colMap = {
      companyProfile: 'company_profile',
      bankDetails: 'bank_details',
      termsAndWarranties: 'terms_and_warranties',
      statutoryTaxes: 'statutory_taxes',
      governanceSettings: 'governance_settings',
      documentPolicies: 'terms_and_warranties'
    };

    const section = colMap[sectionKey] || sectionKey;

    try {
      const res = await fetch('/api/auth/admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert',
          section,
          values: sectionData
        })
      });

      invalidateCatalogCache(['settings:global', 'catalog:settings', 'catalog:all']);

      if (res.ok) {
        const json = await res.json();
        return { success: true, data: json?.settings };
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to update settings' };
    } catch (err) {
      console.error('[settingsService] Update error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch Pricing Presets, Tier Margins & BOM Presets from Database
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
        baseRatePerKw: Number(data.base_rate_per_kw) || 0,
        subsidyCap: Number(data.subsidy_cap) || 0,
        minMarginPerKw: Number(data.min_margin_per_kw) || 0,
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
   * Save Pricing Presets via secure API
   */
  async savePricingPresets(presets) {
    try {
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-presets',
          presets
        })
      });

      invalidateCatalogCache(['catalog:presets', 'catalog:all']);
      if (res.ok) return { success: true };
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to save pricing presets' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Save BOS Price Matrix via secure API
   */
  async saveBosPriceMatrix(matrixRows) {
    if (!Array.isArray(matrixRows) || matrixRows.length === 0) return { success: true };
    try {
      const res = await fetch('/api/auth/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert-bos',
          items: matrixRows
        })
      });

      invalidateCatalogCache(['catalog:bos', 'catalog:all']);
      if (res.ok) return { success: true };
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to save BOS matrix' };
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
   * Fetch Audit Logs from Database / API
   */
  async getAuditLogs(limit = 100) {
    try {
      const res = await fetch('/api/auth/admin-audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'list', limit, offset: 0 })
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.logs)) {
          return json.logs.map(log => ({
            id: log.id,
            timestamp: log.created_at || new Date().toISOString(),
            action: log.action || 'SYSTEM_ACTION',
            module: log.entity_type || 'SYSTEM',
            recordId: log.entity_id || '-',
            userId: log.actor_id || 'ADM-001',
            userName: log.actor_email || 'Super Admin Desk',
            role: log.actor_role || 'admin',
            details: typeof log.details === 'object' && log.details !== null
              ? (log.details.message || JSON.stringify(log.details))
              : (log.details || ''),
            ipAddress: log.ip_address,
            status: 'VERIFIED'
          }));
        }
      }
    } catch (_) {}

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[settingsService] Failed to fetch audit logs:', error.message);
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
   * Log activity via secure server API
   */
  async logActivity(logEntry) {
    if (!logEntry) return;

    try {
      await fetch('/api/auth/admin-audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'log',
          action: logEntry.action || 'SYSTEM_ACTION',
          entity: logEntry.module || 'SYSTEM',
          entityId: logEntry.recordId,
          details: logEntry.details
        })
      });
    } catch (err) {
      console.warn('[settingsService] logActivity notice:', err.message);
    }
  }
};

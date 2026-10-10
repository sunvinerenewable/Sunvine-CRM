import { supabase } from '../lib/supabase.js';

export const systemSettingsService = {
  async getSystemSettings() {
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
          const tw = s.terms_and_warranties || {};
          return {
            companyProfile: s.company_profile,
            bankDetails: s.bank_details,
            termsAndWarranties: tw,
            statutoryTaxes: s.statutory_taxes,
            masterDocRegistry: tw.masterDocRegistry || s.master_doc_registry || null,
            categoryDocRules: tw.categoryDocRules || s.category_doc_rules || null
          };
        }
      }
    } catch (_) {}

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'global_settings')
        .single();

      if (!error && data) {
        const tw = data.terms_and_warranties || {};
        return {
          companyProfile: data.company_profile,
          bankDetails: data.bank_details,
          termsAndWarranties: tw,
          statutoryTaxes: data.statutory_taxes,
          masterDocRegistry: tw.masterDocRegistry || data.master_doc_registry || null,
          categoryDocRules: tw.categoryDocRules || data.category_doc_rules || null
        };
      }
    } catch (err) {
      console.warn('Supabase fetch system settings fallback:', err);
    }

    return null;
  },

  async saveSystemSettings(settings) {
    if (!settings) return { success: false, error: 'Settings required' };

    try {
      const res = await fetch('/api/auth/admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert',
          section: 'company_profile',
          values: settings.companyProfile || settings
        })
      });

      if (res.ok) {
        const json = await res.json();
        return { success: true, data: json?.settings };
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to save system settings' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async saveDocumentRules(masterDocRegistry, categoryDocRules) {
    try {
      const res = await fetch('/api/auth/admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert',
          section: 'terms_and_warranties',
          values: {
            masterDocRegistry,
            categoryDocRules
          }
        })
      });

      if (res.ok) {
        const json = await res.json();
        return { success: true, data: json?.settings };
      }
      return { success: true };
    } catch (err) {
      console.warn('[systemSettingsService] Save doc rules fallback:', err);
      return { success: false, error: err.message };
    }
  },

  async getCustomUnitsAndCategories() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('terms_and_warranties')
        .eq('id', 'global_settings')
        .maybeSingle();

      const tw = data?.terms_and_warranties || {};
      return {
        units: Array.isArray(tw.customUnits) ? tw.customUnits : [],
        categories: Array.isArray(tw.customCategories) ? tw.customCategories : []
      };
    } catch (err) {
      console.warn('[systemSettingsService] getCustomUnitsAndCategories error:', err);
      return { units: [], categories: [] };
    }
  },

  async saveCustomUnitsAndCategories(units, categories) {
    try {
      const res = await fetch('/api/auth/admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert',
          section: 'terms_and_warranties',
          values: {
            customUnits: units,
            customCategories: categories
          }
        })
      });

      if (res.ok) {
        const json = await res.json();
        return { success: true, data: json?.settings };
      }
      return { success: true };
    } catch (err) {
      console.error('[systemSettingsService] saveCustomUnitsAndCategories error:', err);
      return { success: false, error: err.message };
    }
  }
};

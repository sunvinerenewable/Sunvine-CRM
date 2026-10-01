import { supabase } from '../lib/supabase';

const SYSTEM_SETTINGS_KEY = 'sunvine_system_settings';

export const systemSettingsService = {
  async getSystemSettings() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'global_settings')
        .single();

      if (!error && data) {
        const settings = {
          companyProfile: data.company_profile,
          bankDetails: data.bank_details,
          termsAndWarranties: data.terms_and_warranties,
          statutoryTaxes: data.statutory_taxes
        };
        localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(settings));
        return settings;
      }
    } catch (err) {
      console.warn('Supabase fetch system settings fallback:', err);
    }

    try {
      const cached = localStorage.getItem(SYSTEM_SETTINGS_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  },

  async saveSystemSettings(settings) {
    if (!settings) return { success: false };

    try {
      localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {}

    try {
      const payload = {
        id: 'global_settings',
        company_profile: settings.companyProfile || settings,
        bank_details: settings.bankDetails || {},
        terms_and_warranties: settings.termsAndWarranties || {},
        statutory_taxes: settings.statutoryTaxes || {},
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('system_settings')
        .upsert([payload], { onConflict: 'id' });

      if (error) {
        return { success: true, localOnly: true, data: settings };
      }
      return { success: true, data };
    } catch (err) {
      return { success: true, localOnly: true, data: settings };
    }
  }
};

import { supabase } from '../lib/supabase';

export const systemSettingsService = {
  async getSystemSettings() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'global_settings')
        .single();

      if (!error && data) {
        return {
          companyProfile: data.company_profile,
          bankDetails: data.bank_details,
          termsAndWarranties: data.terms_and_warranties,
          statutoryTaxes: data.statutory_taxes
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
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

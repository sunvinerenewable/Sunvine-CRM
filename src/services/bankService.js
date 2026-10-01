import { supabase } from '../lib/supabase';

export const bankService = {
  /**
   * Fetch all 47 solar loan banking institutions from Supabase
   */
  async getAllSolarBanks() {
    try {
      const { data, error } = await supabase
        .from('solar_banks')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('[bankService] Fetch warning:', error.message);
        return [];
      }

      return (data || []).map(b => ({
        id: b.id,
        name: b.name,
        shortName: b.short_name || b.name,
        category: b.category,
        categoryLabel: b.category_label,
        interestRate: b.interest_rate,
        maxTenure: b.max_tenure,
        maxLoanAmount: b.max_loan_amount,
        collateralFree: b.collateral_free,
        processingType: b.processing_type,
        subsidyAdjustment: b.subsidy_adjustment,
        portal: b.portal,
        featured: Boolean(b.featured)
      }));
    } catch (err) {
      console.error('[bankService] Fetch exception:', err);
      return [];
    }
  }
};

import { supabase } from '../lib/supabase';

export const quotationService = {
  /**
   * Fetch all quotations (with RLS)
   */
  async getAllQuotations() {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase quotation fetch notice:', error.message);
        return [];
      }
      return (data || []).map(row => {
        // Expand quote_payload if stored as json
        if (row.quote_payload && typeof row.quote_payload === 'object') {
          return { ...row.quote_payload, ...row, id: row.id };
        }
        return row;
      });
    } catch (err) {
      console.error('Fetch quotations error:', err);
      return [];
    }
  },

  /**
   * Save / Sync Quotation to Supabase
   */
  async saveQuotation(quote) {
    if (!quote || !quote.id) return { success: false, error: 'Invalid quotation payload' };

    const payload = {
      id: quote.id,
      dealer_code: quote.dealerCode || 'SV-DLR-0104',
      dealer_name: quote.dealerName || 'Sunline Solar Solutions',
      customer_name: quote.customerName,
      customer_phone: quote.customerPhone,
      customer_city: quote.city || 'Ahmedabad',
      customer_state: quote.state || 'Gujarat',
      system_capacity_kw: Number(quote.systemCapacityKW || quote.capacityKW || quote.capacity) || 5.0,
      panel_type: quote.panelType || quote.solarModule || 'Mono PERC Bi-facial (550W)',
      inverter_type: quote.inverterType || 'Sungrow 5kW Grid-Tie',
      structure_type: quote.structureType || 'High-Rise Galvanized HDG 2.5m',
      base_cost: Number(quote.baseCost) || 0,
      dealer_margin: Number(quote.dealerMargin || quote.dealerTotalMargin) || 0,
      total_amount: Number(quote.totalAmount || quote.grandTotalCustomer) || 0,
      subsidy_amount: Number(quote.subsidyAmount) || 0,
      net_payable: Number(quote.netPayable) || 0,
      status: quote.status || 'Draft',
      updated_at: new Date().toISOString()
    };

    try {
      // Try upserting full quotation
      const { data, error } = await supabase
        .from('quotations')
        .upsert([payload], { onConflict: 'id' })
        .select();

      if (error) {
        console.warn('Supabase quotation save warning:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      console.error('Save quotation error:', err);
      return { success: false, error: err.message };
    }
  }
};

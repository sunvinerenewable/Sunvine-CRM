import { supabase } from '../lib/supabase';

export const quotationService = {
  /**
   * Fetch all quotations (with RLS)
   */
  async getAllQuotations(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

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
   * Helper: Get local quotation by ID from localStorage
   */
  getLocalQuotationById(id) {
    if (typeof window === 'undefined' || !id) return null;
    try {
      const cleanId = String(id).trim().toLowerCase();
      // 1. Check main quotation ledger
      const local = localStorage.getItem('sunvine_quotations');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          const found = parsed.find(q =>
            String(q.id || '').trim().toLowerCase() === cleanId ||
            String(q.quoteId || '').trim().toLowerCase() === cleanId ||
            String(q.quotationNo || '').trim().toLowerCase() === cleanId
          );
          if (found) return found;
        }
      }
      // 2. Check active draft / recently generated quote
      for (const key of ['sunvine_active_draft_quote', 'sunvine_preview_quotation', 'sunvine_last_quote']) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed && (
            String(parsed.id || '').trim().toLowerCase() === cleanId ||
            String(parsed.quoteId || '').trim().toLowerCase() === cleanId
          )) {
            return parsed;
          }
        }
      }
    } catch (_) {}
    return null;
  },

  /**
   * Fetch single quotation by ID (supports public proposal sharing)
   */
  async getQuotationById(id) {
    if (!id) return null;
    const cleanId = String(id).trim();

    // 1. Instant check: local storage
    const local = this.getLocalQuotationById(cleanId);
    if (local) return local;

    try {
      const fetchPromise = supabase
        .from('quotations')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase request timeout')), 1200)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) {
        console.warn('Supabase fetch quotation by ID notice:', error.message);
        return this.getLocalQuotationById(cleanId);
      }
      if (!data) {
        return this.getLocalQuotationById(cleanId);
      }

      if (data.quote_payload && typeof data.quote_payload === 'object') {
        return { ...data.quote_payload, ...data, id: data.id };
      }
      return data;
    } catch (err) {
      return this.getLocalQuotationById(cleanId);
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
      customer_name: quote.customerName || 'Valued Customer',
      customer_phone: quote.customerPhone || '',
      customer_city: quote.city || quote.location || 'Ahmedabad',
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
      quote_payload: quote,
      updated_at: new Date().toISOString()
    };

    try {
      // Instant local cache write
      if (typeof window !== 'undefined') {
        try {
          const local = localStorage.getItem('sunvine_quotations');
          const list = local ? JSON.parse(local) : [];
          if (Array.isArray(list)) {
            const idx = list.findIndex(q => q.id === quote.id);
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...quote };
            } else {
              list.unshift(quote);
            }
            localStorage.setItem('sunvine_quotations', JSON.stringify(list));
          }
          localStorage.setItem('sunvine_last_quote', JSON.stringify(quote));
        } catch (_) {}
      }

      // Try upserting full quotation with fallback if quote_payload column is not yet migrated
      let { data, error } = await supabase
        .from('quotations')
        .upsert([payload], { onConflict: 'id' })
        .select();

      if (error && error.message && error.message.includes('quote_payload')) {
        // Fallback for environments where quote_payload column is not yet migrated
        const { quote_payload, ...fallbackPayload } = payload;
        const res = await supabase
          .from('quotations')
          .upsert([fallbackPayload], { onConflict: 'id' })
          .select();
        data = res.data;
        error = res.error;
      }

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

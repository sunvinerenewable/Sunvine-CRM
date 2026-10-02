import { supabase } from '../lib/supabase';

/**
 * Enterprise Quotation Service
 * 
 * Routes operations through the secure /api/quotations gateway:
 * - Server-side money recomputation
 * - Role-scoped data isolation
 * - Margin cap enforcement
 * - Status transition state machine
 * 
 * Falls back to direct Supabase / local cache only when the API server is unreachable.
 */

export const quotationService = {
  /**
   * Fetch all quotations (scoped by role via server API)
   */
  async getAllQuotations(limit = 100) {
    // 1. Try secure API gateway
    try {
      const res = await fetch(`/api/quotations?action=list&limit=${limit}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && Array.isArray(data.quotations)) {
          return data.quotations.map(row => {
            if (row.quote_payload && typeof row.quote_payload === 'object') {
              return { ...row.quote_payload, ...row, id: row.id };
            }
            return row;
          });
        }
      }
    } catch (err) {
      if (import.meta.env?.PROD) {
        console.error('[quotationService] API unreachable in production:', err?.message || err);
        return [];
      }
    }

    // 2. Direct Supabase fallback
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
   * Fetch single quotation by ID — DB/API
   */
  async getQuotationById(id) {
    if (!id) return null;
    const cleanId = String(id).trim();

    // 1. Try secure API gateway first
    try {
      const res = await fetch(`/api/quotations?action=get&id=${encodeURIComponent(cleanId)}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && json.quotation) {
          const row = json.quotation;
          return (row.quote_payload && typeof row.quote_payload === 'object')
            ? { ...row.quote_payload, ...row, id: row.id }
            : row;
        }
      }
    } catch (_) {
      // API unreachable, fall through
    }

    // 2. Try direct Supabase
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (!error && data) {
        return (data.quote_payload && typeof data.quote_payload === 'object')
          ? { ...data.quote_payload, ...data, id: data.id }
          : data;
      }
    } catch (_) {}

    return null;
  },

  /**
   * Fetch public proposal by unguessable share_token (no auth required)
   */
  async getPublicProposal(shareToken) {
    if (!shareToken) return null;
    try {
      const res = await fetch(`/api/quotations?action=public&token=${encodeURIComponent(shareToken)}`);
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && json.quotation) return json.quotation;
      }
    } catch (_) {}
    return null;
  },

  /**
   * Save / Create quotation via server API gateway.
   * Money logic is recomputed server-side; client numbers are never blindly trusted.
   */
  async saveQuotation(quote) {
    if (!quote) return { success: false, error: 'Quotation data required.' };

    const apiPayload = {
      action: 'save',
      quotation_id: quote.id,
      dealer_id: quote.dealerId || quote.dealer_id,
      dealer_code: quote.dealerCode,
      dealer_name: quote.dealerFirm || quote.dealerName,
      customer_name: quote.customerName || 'Valued Customer',
      customer_phone: quote.customerPhone || '',
      customer_city: quote.city || quote.location || 'Ahmedabad',
      customer_state: quote.state || 'Gujarat',
      system_capacity_kw: Number(quote.systemCapacityKW || quote.capacityKW || quote.capacity) || 5.0,
      panel_id: quote.panelId || quote.selectedPanelId,
      panel_watt: Number(quote.panelWatt) || 550,
      panel_type: quote.panelType || quote.solarModule || 'Mono PERC Bi-facial (550W)',
      inverter_id: quote.inverterId || quote.selectedInverterId,
      inverter_type: quote.inverterType || 'Sungrow 5kW Grid-Tie',
      structure_type: quote.structureType || 'High-Rise Galvanized HDG 2.5m',
      dealer_margin_inr: Number(quote.dealerMargin || quote.dealerTotalMargin) || 0,
      discount_amount: Number(quote.discountAmount) || 0,
      project_type: quote.projectType || 'Residential',
      finance_type: quote.financeType || 'CASH',
      loan_bank: quote.loanBank,
      loan_tenure_years: Number(quote.loanTenureYears) || 5,
      is_direct_company_quote: quote.isDirectCompanyQuote === true,
      bom_items: quote.bomItems || []
    };

    // 1. Send to server API gateway (where money is recomputed)
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(apiPayload)
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && json.quotation) {
          const saved = json.quotation;
          return { success: true, data: saved, isCapped: json._marginExceededAndCapped };
        }
      }

      if (res.status === 422) {
        const errJson = await res.json().catch(() => ({}));
        return { success: false, error: errJson.error || 'Quotation failed validation.' };
      }
    } catch (_) {
      // API server not responding (local dev mode without api server)
    }

    // 2. Local dev fallback (NEVER in production — bypasses server-side money recompute)
    if (import.meta.env?.PROD) {
      return { success: false, error: 'Quotation service temporarily unavailable. Please try again.' };
    }
    try {
      const fallbackPayload = {
        id: quote.id,
        customer_name: apiPayload.customer_name,
        customer_phone: apiPayload.customer_phone,
        customer_city: apiPayload.customer_city,
        customer_state: apiPayload.customer_state,
        system_capacity_kw: apiPayload.system_capacity_kw,
        panel_type: apiPayload.panel_type,
        inverter_type: apiPayload.inverter_type,
        structure_type: apiPayload.structure_type,
        base_cost: Number(quote.baseCost) || 0,
        dealer_margin: Number(quote.dealerMargin || quote.dealerTotalMargin) || 0,
        total_amount: Number(quote.totalAmount || quote.grandTotalCustomer) || 0,
        subsidy_amount: Number(quote.subsidyAmount) || 0,
        net_payable: Number(quote.netPayable) || 0,
        status: quote.status || 'Draft',
        quote_payload: quote,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('quotations')
        .upsert([fallbackPayload], { onConflict: 'id' })
        .select();

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, data: data?.[0] || quote };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Update quotation status with role validation via server API
   */
  async updateQuotationStatus(id, newStatus) {
    if (!id || !newStatus) return { success: false, error: 'ID and status required.' };

    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'status', id, newStatus })
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success) {
          return { success: true };
        }
      }
      if (res.status === 422 || res.status === 403) {
        const errJson = await res.json().catch(() => ({}));
        return { success: false, error: errJson.error || 'Status change not allowed.' };
      }
    } catch (_) {}

    // Fallback (dev only — production must go through API state machine)
    if (import.meta.env?.PROD) {
      return { success: false, error: 'Status update service temporarily unavailable.' };
    }
    try {
      await supabase
        .from('quotations')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete quotation from database
   */
  async deleteQuotation(id) {
    if (!id) return { success: false };
    try {
      await supabase.from('quotations').delete().eq('id', id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

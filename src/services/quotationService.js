/**
 * Enterprise Quotation Service
 * 
 * Routes operations exclusively through the secure /api/quotations gateway:
 * - Server-side money recomputation
 * - Role-scoped data isolation
 * - Margin cap enforcement
 * - Status transition state machine
 * - Zero anonymous direct SELECT / mutation bypasses (BUG-03, SEC-008)
 */

export function normalizeQuotationRow(row) {
  if (!row) return null;
  let payload = {};
  if (typeof row.quote_payload === 'string') {
    try { payload = JSON.parse(row.quote_payload); } catch {}
  } else if (row.quote_payload && typeof row.quote_payload === 'object') {
    payload = row.quote_payload;
  }

  const customerName = row.customer_name || payload.customerName || row.customerName || 'Customer';
  const customerPhone = row.customer_phone || payload.customerPhone || row.customerPhone || '';
  const city = row.customer_city || payload.city || payload.customerCity || row.city || 'Gujarat';
  const state = row.customer_state || payload.state || payload.customerState || row.state || 'Gujarat';
  const capacityKW = Number(row.system_capacity_kw ?? payload.systemCapacityKW ?? payload.capacityKW ?? row.capacity ?? 0);
  const totalAmount = Number(row.total_amount ?? payload.grandTotalCustomer ?? payload.totalAmount ?? row.grandTotalCustomer ?? 0);
  const dealerMargin = Number(row.dealer_margin ?? payload.dealerTotalMargin ?? payload.dealerMargin ?? 0);
  const dealerId = row.dealer_id || payload.dealerId || row.dealerId || payload.dealerCode || row.dealer_code || 'SV-DIRECT';
  const dealerCode = row.dealer_code || payload.dealerCode || row.dealerCode || (dealerId === 'SV-DIRECT' ? 'SV-DIRECT' : dealerId);
  const dealerName = row.dealer_name || payload.dealerName || row.dealerName || (dealerCode === 'SV-DIRECT' ? 'Sunvine Renewable Energy (Head Office)' : 'Solar Partner');
  const status = row.status || payload.status || 'Active / Sent';
  const rawDate = row.created_at || payload.date || payload.createdAt || row.date;
  const displayDate = payload.date || (rawDate ? new Date(rawDate).toLocaleDateString('en-IN') : 'Today');

  return {
    ...payload,
    ...row,
    id: row.id || payload.id,
    quoteNumber: row.id || payload.quoteNumber || payload.id,
    customerName,
    customer_name: customerName,
    customerPhone,
    customer_phone: customerPhone,
    city,
    state,
    systemCapacityKW: capacityKW,
    system_capacity_kw: capacityKW,
    capacity: capacityKW,
    totalAmount,
    grandTotalCustomer: totalAmount,
    total_amount: totalAmount,
    dealerMargin,
    dealer_margin: dealerMargin,
    dealerId,
    dealerCode,
    dealer_code: dealerCode,
    dealerName,
    dealer_name: dealerName,
    status,
    date: displayDate,
    displayDate,
    created_at: row.created_at || rawDate,
    createdAt: row.created_at || rawDate
  };
}

export const quotationService = {
  /**
   * Fetch all quotations (scoped by role via server API)
   */
  async getAllQuotations(limit = 100) {
    try {
      const res = await fetch(`/api/quotations?action=list&limit=${limit}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && Array.isArray(data.quotations)) {
          return data.quotations.map(normalizeQuotationRow).filter(Boolean);
        }
      }
      return [];
    } catch (err) {
      console.error('[quotationService] API fetch error:', err?.message || err);
      return [];
    }
  },

  /**
   * Fetch single quotation by ID via secure API gateway
   */
  async getQuotationById(id) {
    if (!id) return null;
    const cleanId = String(id).trim();

    try {
      const res = await fetch(`/api/quotations?action=get&id=${encodeURIComponent(cleanId)}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && json.quotation) {
          return normalizeQuotationRow(json.quotation);
        }
      }
      return null;
    } catch (err) {
      console.error('[quotationService] API get error:', err?.message || err);
      return null;
    }
  },

  /**
   * Fetch public proposal by unguessable share_token (public view)
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
   * Uses idempotent request_id for duplicate submission safety.
   */
  async saveQuotation(quote) {
    if (!quote) return { success: false, error: 'Quotation data required.' };

    const isEdit = Boolean(quote.isEdit || quote.is_edit);
    const requestId = quote.requestId || quote.request_id || ((typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

    const apiPayload = {
      action: 'save',
      request_id: requestId,
      is_edit: isEdit,
      ...(isEdit && quote.id ? { quotation_id: quote.id } : {}),
      status: quote.status || 'Active / Generated',
      dealer_id: (quote.dealerId === 'SV-DIRECT' || quote.dealer_id === 'SV-DIRECT') ? null : (quote.dealerId || quote.dealer_id),
      dealer_code: quote.dealerCode || quote.dealer_code || (quote.dealerId === 'SV-DIRECT' || quote.dealer_id === 'SV-DIRECT' ? 'SV-DIRECT' : undefined),
      dealer_name: quote.dealerFirm || quote.dealerName || quote.dealer_name,
      customer_name: (quote.customerName || 'Valued Customer').slice(0, 255),
      customer_phone: (quote.customerPhone || '').slice(0, 20),
      customer_city: (quote.city || quote.location || 'Ahmedabad').slice(0, 255),
      customer_state: (quote.state || 'Gujarat').slice(0, 255),
      system_capacity_kw: Number(quote.systemCapacityKW || quote.capacityKW || quote.capacity) || 5.0,
      panel_id: quote.panelId || quote.selectedPanelId || quote.panel_id,
      panel_watt: Number(quote.panelWatt || quote.moduleWattage) || 550,
      panel_type: (quote.panelType || quote.solarModule || 'Mono PERC Bi-facial (550W)').slice(0, 255),
      inverter_id: quote.inverterId || quote.selectedInverterId || quote.inverter_id,
      inverter_type: (quote.inverterType || 'Sungrow 5kW Grid-Tie').slice(0, 255),
      structure_type: (quote.structureType || 'High-Rise Galvanized HDG 2.5m').slice(0, 255),
      dealer_margin_inr: Number(quote.dealerMargin || quote.dealerTotalMargin) || 0,
      discount_amount: Number(quote.discountAmount) || 0,
      project_type: quote.projectType || 'Residential',
      finance_type: quote.financeType || 'CASH',
      loan_bank: quote.loanBank,
      loan_tenure_years: Number(quote.loanTenureYears) || 5,
      is_direct_company_quote: quote.isDirectCompanyQuote === true || quote.dealerId === 'SV-DIRECT' || quote.dealer_id === 'SV-DIRECT',
      bom_items: quote.bomItems || [],
      quote_payload: quote
    };

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

      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `HTTP ${res.status}: Failed to save quotation.` };
    } catch (err) {
      console.error('[quotationService] Save exception:', err);
      return { success: false, error: err.message || 'Quotation service temporarily unavailable.' };
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
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `Status update failed (${res.status}).` };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to update quotation status.' };
    }
  },

  /**
   * Delete quotation from database via secure API
   */
  async deleteQuotation(id) {
    if (!id) return { success: false, error: 'ID is required.' };
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'delete', id })
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success) return { success: true };
      }

      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `Failed to delete quotation (${res.status}).` };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to delete quotation.' };
    }
  }
};

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
          return data.quotations.map(row => {
            if (row.quote_payload && typeof row.quote_payload === 'object') {
              return { ...row.quote_payload, ...row, id: row.id };
            }
            return row;
          });
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
          const row = json.quotation;
          return (row.quote_payload && typeof row.quote_payload === 'object')
            ? { ...row.quote_payload, ...row, id: row.id }
            : row;
        }
      }
    } catch (err) {
      console.error('[quotationService] API get error:', err?.message || err);
    }

    return null;
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

    const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const apiPayload = {
      action: 'save',
      request_id: requestId,
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

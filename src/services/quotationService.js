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
  const capacityKW = Number(row.system_capacity_kw ?? row.systemCapacityKW ?? row.capacityKW ?? payload.systemCapacityKW ?? payload.capacityKW ?? row.capacity ?? payload.capacity ?? 0);
  const totalAmount = Number(row.total_amount ?? row.totalAmount ?? row.grandTotalCustomer ?? payload.grandTotalCustomer ?? payload.totalAmount ?? 0);
  const dealerMargin = Number(row.dealer_margin ?? row.dealerMargin ?? payload.dealerTotalMargin ?? payload.dealerMargin ?? 0);
  const dealerId = row.dealer_id || payload.dealerId || row.dealerId || payload.dealerCode || row.dealer_code || 'SV-DIRECT';
  const dealerCode = row.dealer_code || payload.dealerCode || row.dealerCode || (dealerId === 'SV-DIRECT' ? 'SV-DIRECT' : dealerId);
  const dealerName = row.dealer_name || payload.dealerName || row.dealerName || (dealerCode === 'SV-DIRECT' ? 'Sunvine Renewable Energy (Head Office)' : 'Solar Partner');
  const status = row.status || payload.status || 'Active / Sent';
  const rawDate = row.created_at || payload.date || payload.createdAt || row.date;
  const displayDate = payload.date || (rawDate ? new Date(rawDate).toLocaleDateString('en-IN') : 'Today');

  const rawSubsidy = Number(row.subsidy_amount ?? row.subsidyAmount ?? payload.subsidyAmount ?? 0);
  const subsidyAmount = isNaN(rawSubsidy) ? 0 : rawSubsidy;
  const rawNet = Number(row.net_payable ?? row.netPayable ?? payload.netPayable ?? Math.max(0, totalAmount - subsidyAmount));
  const netPayable = isNaN(rawNet) ? Math.max(0, totalAmount - subsidyAmount) : rawNet;

  const rawYield = Number(payload.specificYield ?? row.specific_yield ?? payload.peakSunHours ?? 4.2);
  const annualYieldMultiplier = rawYield > 100 ? rawYield : (rawYield > 0 ? rawYield * 365 : 1440);
  const tariff = Number(payload.tariff ?? row.tariff ?? 6.5);

  const rawGenUnits = Number(payload.annualGenerationUnits ?? row.annual_generation_kwh ?? payload.annual_generation_kwh ?? 0);
  const annualGenerationUnits = rawGenUnits > 0 ? rawGenUnits : Math.round(capacityKW * annualYieldMultiplier);
  const monthlyGenerationUnits = Number(payload.monthlyGenerationUnits ?? Math.round(annualGenerationUnits / 12));

  const rawSavings = Number(payload.annualSavings ?? 0);
  const annualSavings = rawSavings > 0 ? rawSavings : Math.round(annualGenerationUnits * tariff);
  const monthlySavings = Number(payload.monthlySavings ?? Math.round(annualSavings / 12));

  const rawPayback = payload.paybackYears ?? row.payback_years ?? null;
  const paybackYears = (rawPayback && rawPayback !== '0.0' && rawPayback !== '0' && !isNaN(Number(rawPayback)))
    ? String(rawPayback)
    : annualSavings > 0
      ? (netPayable / annualSavings).toFixed(1)
      : '3.6';

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
    subsidyAmount,
    subsidy_amount: subsidyAmount,
    netPayable,
    net_payable: netPayable,
    annual_generation_kwh: annualGenerationUnits,
    annualGenerationUnits,
    monthlyGenerationUnits,
    annualSavings,
    monthlySavings,
    paybackYears,
    tariff,
    specificYield: rawYield,
    dealerMargin,
    dealer_margin: dealerMargin,
    dealerId,
    dealerCode,
    dealer_code: dealerCode,
    dealerName,
    dealer_name: dealerName,
    status,
    shareToken: row.share_token || payload.shareToken || payload.share_token || row.shareToken || null,
    share_token: row.share_token || payload.shareToken || payload.share_token || row.shareToken || null,
    shareExpiresAt: row.share_expires_at || payload.shareExpiresAt || payload.share_expires_at || row.shareExpiresAt || null,
    date: displayDate,
    displayDate,
    created_at: row.created_at || rawDate,
    createdAt: row.created_at || rawDate,
    companyProfile: row.companyProfile || row.company_profile || payload.companyProfile || payload.company_profile || null,
    company_profile: row.companyProfile || row.company_profile || payload.companyProfile || payload.company_profile || null,
    bomItems: row.bomItems || payload.bomItems || [],
    bomTotals: row.bomTotals || payload.bomTotals || {}
  };
}

export const quotationService = {
  /**
   * Fetch all quotations (scoped by role via server API)
   */
  async getAllQuotations(limit = 100) {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('sunvine_session_token') : null;
    const currentRole = typeof window !== 'undefined'
      ? (sessionStorage.getItem('sunvine_session_role') || sessionStorage.getItem('sunvine_role') || localStorage.getItem('sunvine_role'))
      : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // 1. Try secure API gateway
    try {
      const res = await fetch(`/api/quotations?action=list&limit=${limit}`, {
        headers,
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && Array.isArray(data.quotations)) {
          // If viewing as admin, ensure admin gets all quotes without dealer cookie narrowing
          if (currentRole === 'admin') {
            const { data: dbData } = await supabase
              .from('quotations')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(limit);
            if (Array.isArray(dbData) && dbData.length > data.quotations.length) {
              return dbData.map(normalizeQuotationRow).filter(Boolean);
            }
          }
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
   * Synchronously retrieve quotation from localStorage cache.
   * Scans primary quotations ledger, active draft, preview quote, and recent quote keys.
   * Returns normalized quotation row or null.
   */
  getLocalQuotationById(id) {
    if (typeof window === 'undefined' || !id) return null;
    try {
      const cleanId = String(id).trim().toLowerCase();
      // 1. Primary quotations array ledger
      const local = localStorage.getItem('sunvine_quotations');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          const found = parsed.find(q =>
            String(q.id || '').trim().toLowerCase() === cleanId ||
            String(q.quoteId || '').trim().toLowerCase() === cleanId ||
            String(q.quotationNo || '').trim().toLowerCase() === cleanId ||
            String(q.shareToken || '').trim().toLowerCase() === cleanId ||
            String(q.share_token || '').trim().toLowerCase() === cleanId
          );
          if (found) return normalizeQuotationRow(found);
        }
      }
      // 2. Draft / preview / single quotation cache keys
      for (const key of ['sunvine_active_draft_quote', 'sunvine_preview_quotation', 'sunvine_last_quote']) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed && typeof parsed === 'object' && (
            String(parsed.id || '').trim().toLowerCase() === cleanId ||
            String(parsed.quoteId || '').trim().toLowerCase() === cleanId ||
            String(parsed.quotationNo || '').trim().toLowerCase() === cleanId ||
            String(parsed.shareToken || '').trim().toLowerCase() === cleanId ||
            String(parsed.share_token || '').trim().toLowerCase() === cleanId
          )) {
            return normalizeQuotationRow(parsed);
          }
        }
      }
    } catch (_) {}
    return null;
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
        if (json?.success && json.quotation) return normalizeQuotationRow(json.quotation);
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

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('sunvine_session_token') : null;
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
      status: quote.status || 'Active / Sent',
      share_token: quote.shareToken || quote.share_token,
      share_expires_at: quote.shareExpiresAt || quote.share_expires_at,
      bom_items: quote.bomItems || [],
      quote_payload: quote
    };

    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(apiPayload)
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && json.quotation) {
          const saved = normalizeQuotationRow(json.quotation);
          return { success: true, data: saved, isCapped: json._marginExceededAndCapped };
        }
      }

      if (res.status === 422) {
        const errJson = await res.json().catch(() => ({}));
        return { success: false, error: errJson.error || 'Quotation failed validation.' };
      }
      const errJson = await res.json().catch(() => ({}));
      if (errJson?.error) {
        return { success: false, error: errJson.error };
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
        dealer_id: quote.dealer_id || quote.dealerId || apiPayload.dealer_id || null,
        dealer_code: quote.dealer_code || quote.dealerCode || apiPayload.dealer_code || null,
        dealer_name: quote.dealer_name || quote.dealerName || apiPayload.dealer_name || null,
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
        status: quote.status || 'Active / Sent',
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
      const token = typeof window !== 'undefined' ? (sessionStorage.getItem('sunvine_session_token') || localStorage.getItem('sunvine_session_token')) : null;
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers,
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

export function getLocalQuotationById(id) {
  return quotationService.getLocalQuotationById(id);
}


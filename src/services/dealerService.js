import { supabase } from '../lib/supabase.js';

async function invalidateCatalogCache(keys) {
  try {
    await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'invalidate', keys: Array.isArray(keys) ? keys : [keys] })
    });
  } catch (_) {}
}

export const dealerService = {
  /**
   * Fetch all registered dealers from Supabase PostgreSQL (or admin API)
   */
  async getAllDealers() {
    // 1. Try secure admin API endpoint
    try {
      const res = await fetch('/api/auth/admin-dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'list', limit: 100, offset: 0 })
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.dealers)) {
          return json.dealers.map(d => ({
            id: d.dealer_code || d.id,
            uuid: d.id,
            dealerCode: d.dealer_code,
            firmName: d.firm_name,
            contactPerson: d.contact_person,
            mobile: d.mobile_number,
            mobileNumber: d.mobile_number,
            email: d.email,
            city: d.city,
            state: d.state,
            discom: d.discom,
            status: d.status ? (d.status.charAt(0).toUpperCase() + d.status.slice(1).toLowerCase()) : 'Active',
            rating: Number(d.rating) || 4.9,
            tier: d.tier || 'Gold EPC',
            maxMarginCapPerKw: Number(d.max_margin_cap_per_kw) || 0,
            totalCommissionedMw: Number(d.total_commissioned_mw) || 0,
            assignedStaffId: d.assigned_staff_id || 'STF-DIRECT',
            assignedStaffName: d.assigned_staff_name || 'Direct to Company (HQ Desk)',
            pricingConfig: d.pricing_config || {},
            createdAt: d.created_at
          }));
        }
      }
    } catch (_) {}

    // 2. Direct read-only query fallback
    try {
      const { data, error } = await supabase
        .from('dealer_accounts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('[dealerService] Fetch dealers warning:', error.message);
        return [];
      }

      if (Array.isArray(data)) {
        return data.map(d => ({
          id: d.dealer_code || d.id,
          uuid: d.id,
          dealerCode: d.dealer_code,
          firmName: d.firm_name,
          contactPerson: d.contact_person,
          mobile: d.mobile_number,
          mobileNumber: d.mobile_number,
          email: d.email,
          city: d.city,
          state: d.state,
          discom: d.discom,
          status: d.status ? (d.status.charAt(0).toUpperCase() + d.status.slice(1).toLowerCase()) : 'Active',
          rating: Number(d.rating) || 4.9,
          tier: d.tier || 'Gold EPC',
          maxMarginCapPerKw: Number(d.max_margin_cap_per_kw) || 0,
          totalCommissionedMw: Number(d.total_commissioned_mw) || 0,
          assignedStaffId: (() => {
            const rawId = d.assigned_staff_id || d.pricing_config?.assignedStaffId;
            if (rawId === 'STF-001') {
              return (d.pricing_config?.assignedStaffId && d.pricing_config?.assignedStaffId !== 'STF-001')
                ? d.pricing_config.assignedStaffId
                : 'STF-DIRECT';
            }
            return rawId || 'STF-DIRECT';
          })(),
          assignedStaffName: (() => {
            const rawId = d.assigned_staff_id || d.pricing_config?.assignedStaffId;
            if (rawId === 'STF-DIRECT') return 'Direct to Company (HQ Desk)';
            const rawName = d.assigned_staff_name || d.pricing_config?.assignedStaffName;
            if (rawName === 'Jayesh Patel') {
              return (d.pricing_config?.assignedStaffName && d.pricing_config?.assignedStaffName !== 'Jayesh Patel')
                ? d.pricing_config.assignedStaffName
                : (rawId === 'STF-DIRECT' ? 'Direct to Company (HQ Desk)' : 'Sunvine Sales Staff');
            }
            return rawName || 'Direct to Company (HQ Desk)';
          })(),
          bankName: d.bank_name || '',
          accountNumber: d.account_number || '',
          ifscCode: d.ifsc_code || '',
          branch: d.branch || '',
          pricingConfig: d.pricing_config || {},
          createdAt: d.created_at
        }));
      }
    } catch (err) {
      console.warn('[dealerService] Error fetching dealers:', err);
    }

    return [];
  },

  /**
   * Create a new dealer securely via backend API
   */
  async createDealer(dealer) {
    if (!dealer) return { success: false, error: 'Dealer details required' };
    const cleanPhone = String(dealer.mobile || dealer.mobileNumber || '').replace(/\D/g, '').slice(-10);
    const dealerCode = dealer.dealerCode || dealer.id || `SV-DLR-${Date.now().toString().slice(-4)}`;
    const plainPassword = String(dealer.password || dealer.accessCode || 'Sunvine@2026').trim();
    const assignedStaffId = dealer.assignedStaffId || 'STF-DIRECT';
    const assignedStaffName = assignedStaffId === 'STF-DIRECT'
      ? 'Direct to Company (HQ Desk)'
      : (dealer.assignedStaffName || 'Sunvine Sales Staff');

    const dealerPayload = {
      dealerCode,
      firmName: dealer.firmName || '',
      contactPerson: dealer.contactPerson || '',
      mobile: cleanPhone,
      email: (dealer.email && String(dealer.email).trim()) ? String(dealer.email).trim() : '',
      city: dealer.city || '',
      state: dealer.state || '',
      discom: dealer.discom || '',
      tier: dealer.tier || 'Gold EPC',
      maxMarginCapPerKw: Number(dealer.maxMarginCapPerKw) || 0,
      password: plainPassword,
      status: (dealer.status || 'Active').toLowerCase(),
      address: dealer.address || '',
      gstin: dealer.gstin || '',
      pan: dealer.pan || '',
      assignedStaffId,
      assignedStaffName,
      pricingConfig: {
        ...(dealer.pricingConfig || {}),
        assignedStaffId,
        assignedStaffName
      }
    };

    // 1. Try /api/auth/admin-dealers
    try {
      const res = await fetch('/api/auth/admin-dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'create',
          dealer: dealerPayload
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        invalidateCatalogCache([`dealer:rates:${dealerCode}`, 'directory:dealers:min', 'catalog:all']);
        return { success: true, id: data.dealer?.dealer_code || dealerCode, dealer: data.dealer };
      }
      if (data?.error) {
        return { success: false, error: data.error };
      }
    } catch (apiErr) {
      console.error('[dealerService] Create dealer exception:', apiErr);
      return { success: false, error: apiErr.message || 'Dealer creation service unavailable.' };
    }

    return { success: false, error: 'Failed to create dealer account.' };
  },

  /**
   * Save / Upsert dealer
   */
  async saveDealer(dealer) {
    if (!dealer) return { success: false, error: 'Dealer required' };
    const dealerCode = dealer.dealerCode || dealer.id;
    return this.updateDealer(dealerCode, dealer);
  },

  /**
   * Update dealer details via backend API
   */
  async updateDealer(dealerCodeOrId, fields) {
    if (!dealerCodeOrId) return { success: false, error: 'Dealer ID required' };

    const updatePayload = {
      dealerCode: dealerCodeOrId,
      ...fields
    };

    if (fields.mobile !== undefined || fields.mobileNumber !== undefined) {
      updatePayload.mobile = String(fields.mobile || fields.mobileNumber).replace(/\D/g, '').slice(-10);
    }

    // 1. Try /api/auth/admin-dealers
    try {
      const res = await fetch('/api/auth/admin-dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert',
          dealer: updatePayload
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          invalidateCatalogCache([`dealer:rates:${dealerCodeOrId}`, 'directory:dealers:min']);
          return { success: true, data: data.dealer };
        }
      }
    } catch (_) {}

    // 2. Try manage-credentials endpoint
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-dealer-credentials',
          payload: {
            dealerCode: dealerCodeOrId,
            id: dealerCodeOrId,
            ...updatePayload
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          invalidateCatalogCache([`dealer:rates:${dealerCodeOrId}`, 'directory:dealers:min']);
          return { success: true, data: data.dealer };
        }
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to update dealer.' };
    } catch (err) {
      console.error('[dealerService] Error updating dealer:', err);
      return { success: false, error: err.message || 'Dealer update service unavailable.' };
    }
  },

  /**
   * Delete dealer via backend API
   */
  async deleteDealer(dealerCodeOrId) {
    const cleanId = String(dealerCodeOrId || '').replace(/^#/, '').trim();
    if (!cleanId) return { success: false, error: 'Dealer identifier is required.' };

    // 1. Try /api/auth/admin-dealers
    try {
      const res = await fetch('/api/auth/admin-dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'delete',
          id: cleanId
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          invalidateCatalogCache([`dealer:rates:${cleanId}`, 'directory:dealers:min']);
          return { success: true };
        }
      }
    } catch (_) {}

    // 2. Try manage-credentials endpoint
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'delete-dealer',
          payload: { dealerCode: cleanId, id: cleanId }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          invalidateCatalogCache([`dealer:rates:${cleanId}`, 'directory:dealers:min']);
          return { success: true };
        }
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to delete dealer.' };
    } catch (err) {
      console.error('[dealerService] Delete dealer exception:', err);
      return { success: false, error: err.message || 'Dealer deletion service unavailable.' };
    }
  }
};

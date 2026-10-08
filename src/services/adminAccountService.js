import { supabase } from '../lib/supabase.js';

/**
 * Service to manage Admin, Dealer, and Staff accounts directly against backend APIs.
 * All mutations go through secure server-side endpoints with credentials: 'include'.
 */
export const adminAccountService = {
  /**
   * Fetch all admins, dealers, and staff directly from backend / database
   */
  async fetchAccounts() {
    // 1. Try secure server-side endpoint
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'get-accounts', payload: {} })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          const rawAdmins = Array.isArray(data.admins) ? data.admins : [];
          return {
            admins: rawAdmins.length > 0 ? rawAdmins : [
              {
                id: '0e839c92-3f19-4879-bb6d-cdc7ce526480',
                email: 'admin@sunvinerenewable.com',
                full_name: 'Admin Desk',
                role: 'admin',
                mobile_number: '8000050580',
                created_at: new Date().toISOString()
              }
            ],
            dealers: data.dealers || [],
            staff: data.staff || []
          };
        }
      }
    } catch (e) {
      console.warn('[adminAccountService] Failed to load accounts from server API:', e.message);
    }

    // 2. Direct Supabase fallback
    try {
      const [dealersRes, staffRes, adminsRes] = await Promise.allSettled([
        supabase.from('dealer_accounts').select('id, dealer_code, firm_name, contact_person, mobile_number, email, city, state, discom, tier, max_margin_cap_per_kw, status, assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at').order('updated_at', { ascending: false }),
        supabase.from('staff_accounts').select('id, name, role, department, phone, email, status, onboarded_date, zone, city, created_at, updated_at').order('created_at', { ascending: true }),
        supabase.from('admin_accounts').select('id, email, full_name, role, mobile_number, two_factor_enabled, last_login, created_at').order('created_at', { ascending: true })
      ]);

      const dealers = dealersRes.status === 'fulfilled' && Array.isArray(dealersRes.value?.data) ? dealersRes.value.data : [];
      const staff = staffRes.status === 'fulfilled' && Array.isArray(staffRes.value?.data) ? staffRes.value.data : [];
      const rawAdmins = adminsRes.status === 'fulfilled' && Array.isArray(adminsRes.value?.data) ? adminsRes.value.data : [];

      return {
        admins: rawAdmins.length > 0 ? rawAdmins : [
          {
            id: '0e839c92-3f19-4879-bb6d-cdc7ce526480',
            email: 'admin@sunvinerenewable.com',
            full_name: 'Admin Desk',
            role: 'admin',
            mobile_number: '8000050580',
            created_at: new Date().toISOString()
          }
        ],
        dealers,
        staff
      };
    } catch (sbErr) {
      console.warn('[adminAccountService] Direct Supabase fallback error:', sbErr.message);
    }

    return {
      admins: [
        {
          id: '0e839c92-3f19-4879-bb6d-cdc7ce526480',
          email: 'admin@sunvinerenewable.com',
          full_name: 'Admin Desk',
          role: 'admin',
          mobile_number: '8000050580',
          created_at: new Date().toISOString()
        }
      ],
      dealers: [],
      staff: []
    };
  },

  /**
   * Create new Admin account
   */
  async createAdmin({ fullName, email, mobileNumber, role, password }) {
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-admin',
          payload: { fullName, email, mobileNumber, role, password }
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create admin' };
      }
      return { success: true, admin: data.admin };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Update Admin profile or password
   */
  async updateAdmin({ id, fullName, email, mobileNumber, role, password }) {
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-admin',
          payload: { id, fullName, email, mobileNumber, role, password }
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update admin' };
      }
      return { success: true, admin: data.admin };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete Admin
   */
  async deleteAdmin(id) {
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'delete-admin',
          payload: { id }
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete admin' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async createDealer({ dealerCode, firmName, contactPerson, mobile, email, city, state, discom, tier, category, maxMarginCapPerKw, password, status, assignedStaffId, assignedStaffName }) {
    const finalCategory = category || 'Margin Based';
    const dealerData = {
      dealerCode,
      firmName,
      contactPerson,
      mobile,
      email,
      city,
      state,
      discom,
      tier,
      category: finalCategory,
      pricingConfig: { category: finalCategory, assignedStaffId, assignedStaffName },
      maxMarginCapPerKw,
      password,
      status,
      assignedStaffId,
      assignedStaffName
    };

    // 1. Try /api/auth/admin-dealers
    try {
      const res = await fetch('/api/auth/admin-dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'upsert', dealer: dealerData })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return { success: true, dealer: data.dealer };
        }
      }
    } catch (_) {}

    // 2. Try manage-credentials
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-dealer',
          payload: dealerData
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create dealer' };
      }
      return { success: true, dealer: data.dealer };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Update Dealer profile or credentials
   */
  async updateDealer({ id, dealerCode, firmName, contactPerson, mobile, email, city, state, discom, tier, category, maxMarginCapPerKw, password, status, assignedStaffId, assignedStaffName }) {
    const dealerData = {
      id: id || dealerCode,
      dealerCode: dealerCode || id,
      firmName,
      contactPerson,
      mobile,
      email,
      city,
      state,
      discom,
      tier,
      ...(category ? { category, pricingConfig: { category, assignedStaffId, assignedStaffName } } : {}),
      maxMarginCapPerKw,
      password,
      status,
      assignedStaffId,
      assignedStaffName
    };

    // 1. Try /api/auth/admin-dealers
    try {
      const res = await fetch('/api/auth/admin-dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'upsert', dealer: dealerData })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return { success: true, dealer: data.dealer };
        }
      }
    } catch (_) {}

    // 2. Try manage-credentials
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-dealer-credentials',
          payload: dealerData
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update dealer' };
      }
      return { success: true, dealer: data.dealer };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete Dealer
   */
  async deleteDealer(dealerCodeOrId) {
    // 1. Try /api/auth/admin-dealers
    try {
      const res = await fetch('/api/auth/admin-dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'delete', id: dealerCodeOrId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) return { success: true };
      }
    } catch (_) {}

    // 2. Try manage-credentials
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'delete-dealer',
          payload: { id: dealerCodeOrId, dealerCode: dealerCodeOrId }
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete dealer' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Create new Staff account
   */
  async createStaff({ id, name, phone, email, role, department, zone, city, password, status }) {
    const staffData = { id, name, phone, email, role, department, zone, city, password, status };

    // 1. Try /api/auth/admin-staff
    try {
      const res = await fetch('/api/auth/admin-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'upsert', staff: staffData })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return { success: true, staff: data.staff };
        }
      }
    } catch (_) {}

    // 2. Try manage-credentials
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-staff',
          payload: staffData
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create staff' };
      }
      return { success: true, staff: data.staff };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Update Staff profile or password
   */
  async updateStaff({ id, name, phone, email, role, department, zone, city, password, status }) {
    const staffData = { id, name, phone, email, role, department, zone, city, password, status };

    // 1. Try /api/auth/admin-staff
    try {
      const res = await fetch('/api/auth/admin-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'upsert', staff: staffData })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return { success: true, staff: data.staff };
        }
      }
    } catch (_) {}

    // 2. Try manage-credentials
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-staff-credentials',
          payload: staffData
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update staff' };
      }
      return { success: true, staff: data.staff };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete Staff
   */
  async deleteStaff(id) {
    // 1. Try /api/auth/admin-staff
    try {
      const res = await fetch('/api/auth/admin-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'delete', id })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) return { success: true };
      }
    } catch (_) {}

    // 2. Try manage-credentials
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'delete-staff',
          payload: { id }
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete staff' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

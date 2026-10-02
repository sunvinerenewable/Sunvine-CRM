import { supabase } from '../lib/supabase';
import bcrypt from 'bcryptjs';

/**
 * Service to manage Admin, Dealer, and Staff accounts directly against live PostgreSQL database.
 * No mock data. No in-memory only state.
 */
export const adminAccountService = {
  /**
   * Fetch all admins, dealers, and staff directly from live database
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
          return {
            admins: data.admins || [],
            dealers: data.dealers || [],
            staff: data.staff || []
          };
        }
      }
    } catch (e) {
      console.warn('[adminAccountService] Server API unavailable, falling back to direct DB:', e.message);
    }

    // 2. Direct Supabase query fallback
    try {
      const [adminsRes, dealersRes, staffRes] = await Promise.all([
        supabase.from('admin_accounts').select('*').order('created_at', { ascending: true }),
        supabase.from('dealer_accounts').select('*').order('updated_at', { ascending: false }),
        supabase.from('staff_accounts').select('*').order('created_at', { ascending: true })
      ]);

      return {
        admins: adminsRes.data || [],
        dealers: dealersRes.data || [],
        staff: staffRes.data || []
      };
    } catch (err) {
      console.error('[adminAccountService] Failed to load accounts:', err);
      return { admins: [], dealers: [], staff: [] };
    }
  },

  /**
   * Create new Admin account in PostgreSQL
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
   * Update Admin profile or password in PostgreSQL
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
   * Delete Admin from PostgreSQL
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

  /**
   * Create new Dealer account in PostgreSQL
   */
  async createDealer({ dealerCode, firmName, contactPerson, mobile, email, city, state, discom, tier, maxMarginCapPerKw, password, status }) {
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-dealer',
          payload: { dealerCode, firmName, contactPerson, mobile, email, city, state, discom, tier, maxMarginCapPerKw, password, status }
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
   * Update Dealer profile or credentials in PostgreSQL
   */
  async updateDealer({ id, dealerCode, firmName, contactPerson, mobile, email, city, state, discom, tier, maxMarginCapPerKw, password, status }) {
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-dealer-credentials',
          payload: { id, dealerCode, firmName, contactPerson, mobile, email, city, state, discom, tier, maxMarginCapPerKw, password, status }
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
   * Delete Dealer from PostgreSQL
   */
  async deleteDealer(dealerCodeOrId) {
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
   * Create new Staff account in PostgreSQL
   */
  async createStaff({ id, name, phone, email, role, department, zone, city, password, status }) {
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-staff',
          payload: { id, name, phone, email, role, department, zone, city, password, status }
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
   * Update Staff profile or password in PostgreSQL
   */
  async updateStaff({ id, name, phone, email, role, department, zone, city, password, status }) {
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-staff-credentials',
          payload: { id, name, phone, email, role, department, zone, city, password, status }
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
   * Delete Staff from PostgreSQL
   */
  async deleteStaff(id) {
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

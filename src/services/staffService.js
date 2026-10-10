import { supabase } from '../lib/supabase.js';

export const staffService = {
  /**
   * Fetch all staff members from backend API or Supabase PostgreSQL read-only query
   */
  async getAllStaff() {
    // 1. Try secure admin API endpoint
    try {
      const res = await fetch('/api/auth/admin-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'list', limit: 100, offset: 0 })
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.staff)) {
          return json.staff.map(s => ({
            id: s.id,
            name: s.name,
            role: s.role,
            phone: s.phone || s.mobile_number,
            email: s.email,
            zone: s.zone,
            city: s.city,
            department: s.department || (String(s.role || '').toLowerCase().includes('verification') ? 'Verification' : 'Sales'),
            status: s.status || 'Active',
            onboardedDate: s.onboarded_date || '2026-01-10',
            dealersCount: Number(s.dealers_count) || 0,
            directFilesCount: Number(s.direct_files_count) || 0,
            dealerFilesCount: Number(s.dealer_files_count) || 0,
            pipelineKw: Number(s.pipeline_kw) || 0,
            rating: Number(s.rating) || 4.9
          }));
        }
      }
    } catch (_) {}

    // 2. Read-only query fallback
    try {
      const { data, error } = await supabase
        .from('staff_accounts')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.warn('[staffService] Fetch staff warning:', error.message);
        return [];
      }

      if (Array.isArray(data)) {
        return data.map(s => ({
          id: s.id,
          name: s.name,
          role: s.role,
          phone: s.phone,
          email: s.email,
          zone: s.zone,
          city: s.city,
          department: s.department || (String(s.role || '').toLowerCase().includes('verification') ? 'Verification' : 'Sales'),
          status: s.status || 'Active',
          onboardedDate: s.onboarded_date || '2026-01-10',
          dealersCount: Number(s.dealers_count) || 0,
          directFilesCount: Number(s.direct_files_count) || 0,
          dealerFilesCount: Number(s.dealer_files_count) || 0,
          pipelineKw: Number(s.pipeline_kw) || 0,
          rating: Number(s.rating) || 4.9
        }));
      }
    } catch (err) {
      console.warn('[staffService] Error fetching staff:', err);
    }

    return [];
  },

  /**
   * Create staff member via secure backend API
   */
  async createStaff(staff) {
    if (!staff || !staff.name || !staff.phone) {
      return { success: false, error: 'Staff name and phone number required' };
    }

    const cleanPhone = String(staff.phone).replace(/\D/g, '').slice(-10);
    const staffId = staff.id || `STF-${Date.now().toString().slice(-4)}`;
    const plainPassword = String(staff.password || staff.accessCode || 'Sunvine@2026').trim();
    const isVerification = String(staff.role || '').toLowerCase().includes('verification') || String(staff.department || '').toLowerCase().includes('verification');
    const department = staff.department || (isVerification ? 'verification' : 'sales');

    const staffPayload = {
      ...staff,
      id: staffId,
      name: staff.name,
      phone: cleanPhone,
      email: staff.email || `${cleanPhone}@sunvine.in`,
      role: staff.role || (isVerification ? 'Field Verification Officer' : 'Senior Solar Field Executive'),
      department: String(department).toLowerCase(),
      zone: staff.zone || 'Gujarat',
      city: staff.city || 'Ahmedabad',
      password: plainPassword,
      status: (staff.status || 'Active').toLowerCase()
    };

    // 1. Try /api/auth/admin-staff
    try {
      const res = await fetch('/api/auth/admin-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert',
          staff: staffPayload
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return { success: true, id: data.staff?.id || staffId, staff: data.staff };
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
          action: 'create-staff',
          payload: staffPayload
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return { success: true, id: data.staff?.id || staffId, staff: data.staff };
        }
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to create staff account.' };
    } catch (apiErr) {
      console.error('[staffService] Create staff exception:', apiErr);
      return { success: false, error: apiErr.message || 'Staff creation service unavailable.' };
    }
  },

  /**
   * Save / Upsert staff member
   */
  async saveStaff(staff) {
    if (!staff || !staff.id) return { success: false, error: 'Staff ID required' };
    return this.updateStaff(staff.id, staff);
  },

  /**
   * Update staff member fields via secure backend API
   */
  async updateStaff(staffId, fields) {
    if (!staffId) return { success: false, error: 'Staff ID required' };

    const payload = {
      id: staffId,
      ...fields
    };
    if (fields.phone) {
      payload.phone = String(fields.phone).replace(/\D/g, '').slice(-10);
    }
    if (fields.password || fields.accessCode) {
      payload.password = String(fields.password || fields.accessCode).trim();
    }

    // 1. Try /api/auth/admin-staff
    try {
      const res = await fetch('/api/auth/admin-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert',
          staff: payload
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return { success: true, data: data.staff };
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
          action: 'update-staff-credentials',
          payload: {
            staffId,
            id: staffId,
            ...payload
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return { success: true, data: data.staff };
        }
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to update staff.' };
    } catch (err) {
      console.error('[staffService] Update staff exception:', err);
      return { success: false, error: err.message || 'Staff update service unavailable.' };
    }
  },

  /**
   * Update staff password via secure backend API
   */
  async updateStaffPassword(staffId, newPassword) {
    if (!newPassword || newPassword.length < 1) {
      return { success: false, error: 'Password cannot be empty.' };
    }

    // 1. Try /api/auth/admin-staff
    try {
      const res = await fetch('/api/auth/admin-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert',
          staff: { id: staffId, password: newPassword }
        })
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
          action: 'update-staff-credentials',
          payload: { staffId, id: staffId, password: newPassword }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) return { success: true };
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to update password.' };
    } catch (err) {
      return { success: false, error: err.message || 'Password update service unavailable.' };
    }
  },

  /**
   * Delete staff member via secure backend API
   */
  async deleteStaff(staffId) {
    if (!staffId) return { success: false, error: 'Staff ID is required.' };

    // 1. Try /api/auth/admin-staff
    try {
      const res = await fetch('/api/auth/admin-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'delete',
          id: staffId
        })
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
          payload: { staffId, id: staffId }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) return { success: true };
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to delete staff.' };
    } catch (err) {
      return { success: false, error: err.message || 'Staff deletion service unavailable.' };
    }
  }
};

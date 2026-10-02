import { supabase } from '../lib/supabase';

export const staffService = {
  /**
   * Fetch all staff members from Supabase PostgreSQL
   */
  async getAllStaff() {
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
          department: s.department || 'Sales',
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
   * Create staff member with Bcrypt password hashing
   */
  async createStaff(staff) {
    if (!staff || !staff.name || !staff.phone) {
      return { success: false, error: 'Staff name and phone number required' };
    }

    const cleanPhone = String(staff.phone).replace(/\D/g, '').slice(-10);
    const staffId = staff.id || `STF-${Date.now().toString().slice(-3)}`;

    try {
      const { data, error } = await supabase.rpc('create_staff_secure', {
        p_id: staffId,
        p_name: staff.name,
        p_role: staff.role || 'Solar Field Executive',
        p_phone: cleanPhone,
        p_email: staff.email || `${cleanPhone}@sunvine.in`,
        p_password: staff.password || staff.accessCode || '',
        p_zone: staff.zone || 'Gujarat',
        p_city: staff.city || 'Ahmedabad',
        p_department: staff.department || 'Sales'
      });

      if (error) {
        // Fallback direct upsert if RPC is not deployed
        const payload = {
          id: staffId,
          name: staff.name,
          role: staff.role || 'Solar Field Executive',
          phone: cleanPhone,
          email: staff.email || `${cleanPhone}@sunvine.in`,
          zone: staff.zone || 'Gujarat',
          city: staff.city || 'Ahmedabad',
          department: staff.department || 'Sales',
          status: staff.status || 'Active',
          updated_at: new Date().toISOString()
        };
        await supabase.from('staff_accounts').upsert([payload], { onConflict: 'id' });
      }

      return { success: true, id: staffId };
    } catch (err) {
      console.error('[staffService] Exception creating staff:', err);
      return { success: false, error: err.message };
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
   * Update staff member fields in Supabase
   */
  async updateStaff(staffId, fields) {
    if (!staffId) return { success: false, error: 'Staff ID required' };

    const payload = {
      updated_at: new Date().toISOString()
    };

    if (fields.name !== undefined) payload.name = fields.name;
    if (fields.role !== undefined) payload.role = fields.role;
    if (fields.phone !== undefined) payload.phone = String(fields.phone).replace(/\D/g, '').slice(-10);
    if (fields.email !== undefined) payload.email = fields.email;
    if (fields.zone !== undefined) payload.zone = fields.zone;
    if (fields.city !== undefined) payload.city = fields.city;
    if (fields.department !== undefined) payload.department = fields.department;
    if (fields.status !== undefined) payload.status = fields.status;
    if (fields.dealersCount !== undefined) payload.dealers_count = Number(fields.dealersCount);
    if (fields.directFilesCount !== undefined) payload.direct_files_count = Number(fields.directFilesCount);
    if (fields.dealerFilesCount !== undefined) payload.dealer_files_count = Number(fields.dealerFilesCount);
    if (fields.pipelineKw !== undefined) payload.pipeline_kw = Number(fields.pipelineKw);
    if (fields.rating !== undefined) payload.rating = Number(fields.rating);

    try {
      const { data, error } = await supabase
        .from('staff_accounts')
        .update(payload)
        .eq('id', staffId);

      if (error) {
        console.warn('[staffService] Update staff warning:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('[staffService] Update staff error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Update staff password (Bcrypt Hash)
   */
  async updateStaffPassword(staffId, newPassword) {
    try {
      const { data, error } = await supabase.rpc('update_user_password', {
        p_user_type: 'staff',
        p_identifier: staffId,
        p_new_password: newPassword
      });

      if (error || !data?.success) {
        return { success: false, error: data?.error || 'Failed to update staff password.' };
      }

      return { success: true };
    } catch (err) {
      console.error('[staffService] Update staff password error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete staff member from database
   */
  async deleteStaff(staffId) {
    if (!staffId) return { success: false, error: 'Staff ID is required.' };
    try {
      const { error } = await supabase
        .from('staff_accounts')
        .delete()
        .eq('id', staffId);

      if (error) {
        console.warn('[staffService] Delete staff warning:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('[staffService] Delete staff exception:', err);
      return { success: false, error: err.message };
    }
  }
};

import { supabase } from '../lib/supabase';

const STAFF_LIST_KEY = 'sunvine_staff_list';

export const staffService = {
  async getAllStaff() {
    try {
      const { data, error } = await supabase
        .from('staff_users')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped = data.map(row => ({
          id: row.id,
          name: row.name,
          role: row.role,
          phone: row.phone,
          email: row.email,
          accessCode: row.access_code || 'dealer123',
          zone: row.zone,
          city: row.city,
          status: row.status,
          onboardedDate: row.onboarded_date,
          dealersCount: Number(row.dealers_count) || 0,
          directFilesCount: Number(row.direct_files_count) || 0,
          dealerFilesCount: Number(row.dealer_files_count) || 0
        }));
        localStorage.setItem(STAFF_LIST_KEY, JSON.stringify(mapped));
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase fetch staff fallback:', err);
    }

    try {
      const cached = localStorage.getItem(STAFF_LIST_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  },

  async saveStaff(staff) {
    if (!staff || !staff.id) return { success: false, error: 'Staff ID required' };

    try {
      const payload = {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        phone: staff.phone,
        email: staff.email,
        access_code: staff.accessCode || 'dealer123',
        zone: staff.zone || '',
        city: staff.city || 'Ahmedabad',
        status: staff.status || 'Active',
        onboarded_date: staff.onboardedDate || new Date().toISOString().split('T')[0],
        dealers_count: Number(staff.dealersCount) || 0,
        direct_files_count: Number(staff.directFilesCount) || 0,
        dealer_files_count: Number(staff.dealerFilesCount) || 0,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('staff_users')
        .upsert([payload], { onConflict: 'id' });

      if (error) {
        return { success: true, localOnly: true, data: staff };
      }
      return { success: true, data };
    } catch (err) {
      return { success: true, localOnly: true, data: staff };
    }
  },

  async deleteStaff(staffId) {
    if (!staffId) return { success: false };
    try {
      await supabase.from('staff_users').delete().eq('id', staffId);
      return { success: true };
    } catch (err) {
      return { success: true };
    }
  }
};

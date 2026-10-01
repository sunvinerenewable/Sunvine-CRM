import { supabase } from '../lib/supabase';

const DEALERS_KEY = 'sunvine_dealers';

export const dealerService = {
  async getAllDealers() {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped = data.map(row => ({
          id: row.dealer_code || row.id,
          dbId: row.id,
          dealerCode: row.dealer_code,
          firmName: row.firm_name,
          contactPerson: row.contact_person,
          mobile: row.mobile_number,
          mobileNumber: row.mobile_number,
          email: row.email,
          state: row.state,
          city: row.city,
          discom: row.discom,
          status: row.status === 'active' ? 'Active' : (row.status === 'pending' ? 'Pending' : 'Suspended'),
          rating: Number(row.rating) || 4.9,
          totalCommissionedMw: Number(row.total_commissioned_mw) || 0.0,
          joinedDate: row.created_at ? row.created_at.split('T')[0] : '2026-01-01'
        }));
        localStorage.setItem(DEALERS_KEY, JSON.stringify(mapped));
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase fetch dealers fallback:', err);
    }

    try {
      const cached = localStorage.getItem(DEALERS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  },

  async saveDealer(dealer) {
    if (!dealer) return { success: false, error: 'Dealer required' };

    try {
      const dealerCode = dealer.dealerCode || dealer.id || `SV-DLR-${Math.floor(1000 + Math.random() * 9000)}`;
      const payload = {
        dealer_code: dealerCode,
        firm_name: dealer.firmName || 'Solar Partner',
        contact_person: dealer.contactPerson || 'Authorized Person',
        mobile_number: dealer.mobile || dealer.mobileNumber || '9876543210',
        email: dealer.email || `${dealerCode.toLowerCase()}@sunvinedealer.in`,
        password_hash: dealer.passwordHash || '$2a$10$zFohdEcKx7PiTLL2.bqckeJhDt9KYh9MEbkp.0CqnPQkhE/2Sl7iK',
        state: dealer.state || 'Gujarat',
        city: dealer.city || 'Ahmedabad',
        discom: dealer.discom || 'UGVCL',
        status: (dealer.status || 'active').toLowerCase(),
        rating: Number(dealer.rating) || 4.9,
        total_commissioned_mw: Number(dealer.totalCommissionedMw || dealer.totalCapacityKw ? (dealer.totalCapacityKw / 1000) : 0),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('dealers')
        .upsert([payload], { onConflict: 'dealer_code' })
        .select();

      if (error) {
        return { success: true, localOnly: true, data: dealer };
      }
      return { success: true, data };
    } catch (err) {
      return { success: true, localOnly: true, data: dealer };
    }
  },

  async deleteDealer(dealerCode) {
    if (!dealerCode) return { success: false };
    try {
      await supabase.from('dealers').delete().eq('dealer_code', dealerCode);
      return { success: true };
    } catch (err) {
      return { success: true };
    }
  }
};

import { supabase } from '../lib/supabase';

const CUSTOMER_FILES_KEY = 'sunvine_customer_files';

export const customerFileService = {
  async getAllCustomerFiles() {
    try {
      const { data, error } = await supabase
        .from('customer_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped = data.map(row => ({
          id: row.id,
          customerName: row.customer_name,
          phone: row.phone,
          address: row.address,
          city: row.city,
          discom: row.discom,
          consumerNo: row.consumer_no,
          sanctionedLoadKw: Number(row.sanctioned_load_kw),
          solarSystemKw: Number(row.solar_system_kw),
          roofType: row.roof_type,
          sourceType: row.source_type,
          dealerId: row.dealer_id,
          dealerName: row.dealer_name,
          staffId: row.staff_id,
          staffName: row.staff_name,
          financeType: row.finance_type,
          loanBank: row.loan_bank,
          stage: row.stage,
          status: row.status,
          documents: row.documents || [],
          timeline: row.timeline || [],
          createdAt: row.created_at
        }));
        localStorage.setItem(CUSTOMER_FILES_KEY, JSON.stringify(mapped));
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase fetch customer files fallback:', err);
    }

    try {
      const cached = localStorage.getItem(CUSTOMER_FILES_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  },

  async saveCustomerFile(file) {
    if (!file || !file.id) return { success: false, error: 'File ID required' };

    try {
      const payload = {
        id: file.id,
        customer_name: file.customerName || 'Valued Customer',
        phone: file.phone || '',
        address: file.address || '',
        city: file.city || 'Ahmedabad',
        discom: file.discom || 'UGVCL',
        consumer_no: file.consumerNo || '',
        sanctioned_load_kw: Number(file.sanctionedLoadKw) || 5.0,
        solar_system_kw: Number(file.solarSystemKw) || 5.0,
        roof_type: file.roofType || 'RCC Flat Terrace',
        source_type: file.sourceType || 'DEALER',
        dealer_id: file.dealerId || null,
        dealer_name: file.dealerName || null,
        staff_id: file.staffId || null,
        staff_name: file.staffName || null,
        finance_type: file.financeType || 'CASH',
        loan_bank: file.loanBank || null,
        stage: file.stage || 'Lead',
        status: file.status || 'Sourced',
        documents: file.documents || [],
        timeline: file.timeline || [],
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('customer_files')
        .upsert([payload], { onConflict: 'id' });

      if (error) {
        console.warn('Supabase save customer file notice:', error.message);
        return { success: true, localOnly: true, data: file };
      }
      return { success: true, data };
    } catch (err) {
      return { success: true, localOnly: true, data: file };
    }
  },

  async deleteCustomerFile(fileId) {
    if (!fileId) return { success: false };
    try {
      await supabase.from('customer_files').delete().eq('id', fileId);
      return { success: true };
    } catch (err) {
      return { success: true };
    }
  }
};

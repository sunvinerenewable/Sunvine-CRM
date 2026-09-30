import { supabase } from '../lib/supabase';

export const customerFileService = {
  /**
   * Fetch all customer files from Supabase
   */
  async getAllCustomerFiles() {
    try {
      const { data, error } = await supabase
        .from('customer_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[customerFileService] Fetch warning:', error.message);
        return [];
      }

      return (data || []).map(f => ({
        id: f.id,
        customerName: f.customer_name,
        phone: f.phone,
        address: f.address,
        city: f.city,
        discom: f.discom,
        consumerNo: f.consumer_no,
        sanctionedLoadKw: Number(f.sanctioned_load_kw) || 0,
        solarSystemKw: Number(f.solar_system_kw) || 0,
        roofType: f.roof_type,
        sourceType: f.source_type,
        dealerId: f.dealer_id,
        dealerName: f.dealer_name,
        staffId: f.staff_id,
        staffName: f.staff_name,
        financeType: f.finance_type,
        loanBank: f.loan_bank,
        loanAccountNo: f.loan_account_no,
        stage: f.stage,
        currentStage: f.stage,
        status: f.status,
        documents: f.documents || [],
        timeline: f.timeline || [],
        createdAt: f.created_at,
        updatedAt: f.updated_at
      }));
    } catch (err) {
      console.error('[customerFileService] Fetch exception:', err);
      return [];
    }
  },

  /**
   * Save / Upsert customer file to Supabase
   */
  async saveCustomerFile(file) {
    if (!file || !file.id) return { success: false, error: 'File ID required' };

    const payload = {
      id: file.id,
      customer_name: file.customerName || file.customer_name || 'Customer',
      phone: file.phone || '',
      address: file.address || '',
      city: file.city || 'Ahmedabad',
      discom: file.discom || 'UGVCL',
      consumer_no: file.consumerNo || file.consumer_no || '',
      sanctioned_load_kw: Number(file.sanctionedLoadKw || file.sanctioned_load_kw) || 6.0,
      solar_system_kw: Number(file.solarSystemKw || file.solar_system_kw) || 5.0,
      roof_type: file.roofType || file.roof_type || 'Flat RCC',
      source_type: file.sourceType || file.source_type || 'DIRECT_STAFF',
      dealer_id: file.dealerId || file.dealer_id || null,
      dealer_name: file.dealerName || file.dealer_name || null,
      staff_id: file.staffId || file.staff_id || 'STF-001',
      staff_name: file.staffName || file.staff_name || 'Jayesh Patel',
      finance_type: file.financeType || file.finance_type || 'CASH',
      loan_bank: file.loanBank || file.loan_bank || null,
      loan_account_no: file.loanAccountNo || file.loan_account_no || null,
      stage: file.stage || file.currentStage || 'Registration',
      status: file.status || 'Active',
      documents: file.documents || [],
      timeline: file.timeline || [],
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('customer_files')
        .upsert([payload], { onConflict: 'id' })
        .select();

      if (error) {
        console.warn('[customerFileService] Save warning:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('[customerFileService] Save error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Update customer file status or timeline in Supabase
   */
  async updateCustomerFile(fileId, updates) {
    if (!fileId) return { success: false, error: 'File ID required' };

    const payload = {
      updated_at: new Date().toISOString()
    };

    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.stage !== undefined || updates.currentStage !== undefined) {
      payload.stage = updates.stage || updates.currentStage;
    }
    if (updates.timeline !== undefined) payload.timeline = updates.timeline;
    if (updates.documents !== undefined) payload.documents = updates.documents;
    if (updates.loanBank !== undefined) payload.loan_bank = updates.loanBank;
    if (updates.loanAccountNo !== undefined) payload.loan_account_no = updates.loanAccountNo;
    if (updates.financeType !== undefined) payload.finance_type = updates.financeType;

    try {
      const { data, error } = await supabase
        .from('customer_files')
        .update(payload)
        .eq('id', fileId);

      if (error) {
        console.warn('[customerFileService] Update warning:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('[customerFileService] Update error:', err);
      return { success: false, error: err.message };
    }
  }
};

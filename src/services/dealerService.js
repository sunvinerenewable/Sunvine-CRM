import { supabase } from '../lib/supabase';

export const dealerService = {
  /**
   * Fetch all dealers from Supabase
   */
  async getAllDealers() {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('*')
        .order('dealer_code', { ascending: true });

      if (error) {
        console.warn('[dealerService] Fetch dealers warning:', error.message);
        return [];
      }

      return (data || []).map(d => ({
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
        maxMarginCapPerKw: Number(d.max_margin_cap_per_kw) || 6000,
        totalCommissionedMw: Number(d.total_commissioned_mw) || 0,
        assignedStaffId: d.assigned_staff_id || 'STF-001',
        assignedStaffName: d.assigned_staff_name || 'Jayesh Patel',
        bankName: d.bank_name || 'State Bank of India',
        accountNumber: d.account_number || '394857201948',
        ifscCode: d.ifsc_code || 'SBIN0001234',
        branch: d.branch || `${d.city || 'Ahmedabad'} Main Branch`,
        pricingConfig: d.pricing_config || {},
        createdAt: d.created_at
      }));
    } catch (err) {
      console.error('[dealerService] Error fetching dealers:', err);
      return [];
    }
  },

  /**
   * Create a new dealer securely in Supabase with Bcrypt Hashed password
   */
  async createDealer(dealer) {
    if (!dealer) return { success: false, error: 'Dealer details required' };
    const cleanPhone = String(dealer.mobile || dealer.mobileNumber || '').replace(/\D/g, '').slice(-10);
    const dealerCode = dealer.dealerCode || dealer.id || `SV-DLR-${Date.now().toString().slice(-4)}`;

    try {
      const { data, error } = await supabase.rpc('create_dealer_secure', {
        p_dealer_code: dealerCode,
        p_firm_name: dealer.firmName || 'Gujarat Solar EPC',
        p_contact_person: dealer.contactPerson || 'Authorized Partner',
        p_mobile: cleanPhone,
        p_email: dealer.email || `${cleanPhone}@sunvinedealer.in`,
        p_password: dealer.password || dealer.accessCode || 'dealer123',
        p_city: dealer.city || 'Ahmedabad',
        p_state: dealer.state || 'Gujarat',
        p_discom: dealer.discom || 'UGVCL',
        p_tier: dealer.tier || 'Gold EPC',
        p_max_margin: Number(dealer.maxMarginCapPerKw) || 6000
      });

      if (error) {
        console.error('[dealerService] Create dealer RPC error:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, id: data?.id || dealerCode };
    } catch (err) {
      console.error('[dealerService] Exception creating dealer:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Update dealer details in Supabase
   */
  async updateDealer(dealerCodeOrId, fields) {
    if (!dealerCodeOrId) return { success: false, error: 'Dealer ID required' };

    const updatePayload = {
      updated_at: new Date().toISOString()
    };

    if (fields.firmName !== undefined) updatePayload.firm_name = fields.firmName;
    if (fields.contactPerson !== undefined) updatePayload.contact_person = fields.contactPerson;
    if (fields.mobile !== undefined || fields.mobileNumber !== undefined) {
      updatePayload.mobile_number = String(fields.mobile || fields.mobileNumber).replace(/\D/g, '').slice(-10);
    }
    if (fields.email !== undefined) updatePayload.email = fields.email;
    if (fields.city !== undefined) updatePayload.city = fields.city;
    if (fields.state !== undefined) updatePayload.state = fields.state;
    if (fields.discom !== undefined) updatePayload.discom = fields.discom;
    if (fields.status !== undefined) updatePayload.status = fields.status.toLowerCase();
    if (fields.tier !== undefined) updatePayload.tier = fields.tier;
    if (fields.maxMarginCapPerKw !== undefined) updatePayload.max_margin_cap_per_kw = Number(fields.maxMarginCapPerKw);
    if (fields.bankName !== undefined) updatePayload.bank_name = fields.bankName;
    if (fields.accountNumber !== undefined) updatePayload.account_number = fields.accountNumber;
    if (fields.ifscCode !== undefined) updatePayload.ifsc_code = fields.ifscCode;
    if (fields.branch !== undefined) updatePayload.branch = fields.branch;
    if (fields.pricingConfig !== undefined) updatePayload.pricing_config = fields.pricingConfig;

    try {
      const { data, error } = await supabase
        .from('dealers')
        .update(updatePayload)
        .or(`dealer_code.eq.${dealerCodeOrId},id.eq.${dealerCodeOrId}`);

      if (error) {
        console.warn('[dealerService] Update dealer warning:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('[dealerService] Error updating dealer:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete dealer from database
   */
  async deleteDealer(dealerCodeOrId) {
    if (!dealerCodeOrId) return { success: false, error: 'Dealer identifier is required.' };
    try {
      const { error } = await supabase
        .from('dealers')
        .delete()
        .or(`dealer_code.eq.${dealerCodeOrId},id.eq.${dealerCodeOrId}`);

      if (error) {
        console.warn('[dealerService] Delete dealer warning:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('[dealerService] Delete dealer exception:', err);
      return { success: false, error: err.message };
    }
  }
};

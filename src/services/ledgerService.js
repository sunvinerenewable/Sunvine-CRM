import { supabase } from '../lib/supabase';
import { getSessionToken } from './authService';

/**
 * Enterprise Dealer Financial Ledger Service (Dual-Entry Accounting)
 * 
 * Manages Debit (Dr.) and Credit (Cr.) transaction vouchers for dealers:
 * - Kit Dispatches (Dr.)
 * - Payments Received (Cr.)
 * - Commissions Payable (Cr.) & Disbursed (Dr.)
 * - Portal Registration Fees (Dr.)
 */

export const ledgerService = {
  /**
   * Fetch all ledger entries and compute running balance.
   * Scoped to dealerId if provided.
   */
  async getDealerLedger(dealerId = 'all') {
    // 1. Try secure API gateway
    try {
      const token = getSessionToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const url = `/api/ledger?dealer_id=${encodeURIComponent(dealerId)}`;
      
      const res = await fetch(url, { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && Array.isArray(data.entries)) {
          return {
            success: true,
            entries: data.entries,
            summary: data.summary || { totalDebit: 0, totalCredit: 0, netBalance: 0, totalEntries: 0 }
          };
        }
      }
    } catch (_) {}

    // 2. Direct Supabase fallback
    try {
      let query = supabase
        .from('dealer_ledger_entries')
        .select('*')
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (dealerId && dealerId !== 'all') {
        query = query.eq('dealer_id', dealerId);
      }

      const { data, error } = await query;
      if (error) throw error;

      let runningBalance = 0;
      let totalDebit = 0;
      let totalCredit = 0;

      const entriesWithBalance = (data || []).map(entry => {
        const amt = Number(entry.amount) || 0;
        if (entry.entry_type === 'DEBIT') {
          runningBalance += amt;
          totalDebit += amt;
        } else {
          runningBalance -= amt;
          totalCredit += amt;
        }
        return {
          ...entry,
          running_balance: runningBalance
        };
      });

      return {
        success: true,
        entries: entriesWithBalance.reverse(),
        summary: {
          totalDebit,
          totalCredit,
          netBalance: totalDebit - totalCredit,
          totalEntries: entriesWithBalance.length
        }
      };
    } catch (err) {
      console.warn('[ledgerService] Fetch error:', err.message);
      return {
        success: false,
        error: err.message,
        entries: [],
        summary: { totalDebit: 0, totalCredit: 0, netBalance: 0, totalEntries: 0 }
      };
    }
  },

  /**
   * Create a new transaction voucher entry
   */
  async createVoucher(voucherData) {
    // 1. Try API gateway
    try {
      const token = getSessionToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(voucherData)
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && data.entry) {
          return { success: true, entry: data.entry };
        }
      }
      if (res.status === 400 || res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || 'Failed to create voucher.' };
      }
    } catch (_) {}

    // 2. Direct Supabase fallback
    try {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const voucherNo = voucherData.voucher_no || `VCH-${year}-${Date.now().toString(36).toUpperCase().slice(-4)}-${rand}`;

      const payload = {
        voucher_no: voucherNo,
        dealer_id: voucherData.dealer_id,
        dealer_code: voucherData.dealer_code || '',
        dealer_name: voucherData.dealer_name || 'Dealer Partner',
        customer_file_id: voucherData.customer_file_id || null,
        customer_name: voucherData.customer_name || null,
        entry_date: voucherData.entry_date || new Date().toISOString().split('T')[0],
        entry_type: String(voucherData.entry_type).toUpperCase(),
        category: voucherData.category,
        amount: Number(voucherData.amount),
        payment_mode: voucherData.payment_mode || 'BANK_TRANSFER',
        reference_no: voucherData.reference_no || '',
        narration: String(voucherData.narration || '').trim(),
        proof_url: voucherData.proof_url || null,
        created_by: voucherData.created_by || 'Administrator'
      };

      const { data, error } = await supabase
        .from('dealer_ledger_entries')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return { success: true, entry: data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete a voucher entry (Admin only)
   */
  async deleteVoucher(id) {
    try {
      const token = getSessionToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/ledger?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });
      if (res.ok) return { success: true };
    } catch (_) {}

    try {
      const { error } = await supabase.from('dealer_ledger_entries').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

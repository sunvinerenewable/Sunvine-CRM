import { supabase } from '../lib/supabase.js';
import { getCancellationRetentionStatus } from '../utils/documentUtils.js';

let apiRateLimitedUntil = 0;

export const customerFileService = {
  /**
   * Fetch all customer files from serverless API (Supabase PostgreSQL + Redis cache), or read-only Supabase query
   */
  async getAllCustomerFiles({ throwOnError = false, maxRetries = 0 } = {}) {
    const isRateLimited = Date.now() < apiRateLimitedUntil;

    if (!isRateLimited) {
      let attempt = 0;
      const maxAttempts = maxRetries > 0 ? Math.min(maxRetries, 3) : 1;

      while (attempt < maxAttempts) {
        try {
          const res = await fetch('/api/customer-files', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          });

          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
              return json.data;
            }
          } else if (res.status === 429) {
            console.warn(`[customerFileService] HTTP 429 received. Backing off API for 60s; direct database will serve requests.`);
            apiRateLimitedUntil = Date.now() + 60000;
            if (throwOnError) throw new Error('RATE_LIMITED_429');
            break;
          } else if (res.status === 401 && throwOnError) {
            throw new Error('SESSION_EXPIRED');
          } else {
            break;
          }
        } catch (apiErr) {
          if (apiErr?.message === 'SESSION_EXPIRED' || apiErr?.message === 'RATE_LIMITED_429') {
            if (throwOnError) throw apiErr;
            break;
          }
          console.warn('[customerFileService] API fetch notice, checking database direct:', apiErr);
          break;
        }
      }
    }

    try {
      const { data, error } = await supabase
        .from('customer_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[customerFileService] Supabase direct notice:', error.message);
        if (throwOnError) throw error;
        return [];
      }

      if (Array.isArray(data)) {
        return data.map(f => ({
          id: f.id,
          customerName: f.customer_name,
          phone: f.phone,
          address: f.address,
          city: f.city,
          discom: f.discom,
          discomCircle: f.discom,
          consumerNo: f.consumer_no,
          consumerNumber: f.consumer_no,
          sanctionedLoadKw: Number(f.sanctioned_load_kw) || 0,
          solarSystemKw: Number(f.solar_system_kw) || 0,
          roofType: f.roof_type,
          sourceType: f.source_type || 'DIRECT_STAFF',
          source: f.source_type || 'DIRECT_STAFF',
          dealerId: f.dealer_id,
          dealerName: f.dealer_name,
          staffId: f.staff_id || (f.source_type === 'DEALER' ? 'STF-DIRECT' : 'STF-801'),
          staffName: (f.staff_id === 'STF-DIRECT' || (!f.staff_id && f.source_type === 'DEALER'))
            ? 'Direct to Company (HQ Desk)'
            : (f.staff_name === 'Jayesh Patel' ? 'Sunvine Sales Staff' : (f.staff_name || 'Sunvine Sales Staff')),
          financeType: f.finance_type || 'CASH',
          paymentMode: f.finance_type || 'CASH',
          loanBank: f.loan_bank,
          loanAccountNo: f.loan_account_no,
          loanRefNo: f.loan_account_no,
          stage: f.stage || 'LEAD_SOURCED',
          currentStage: f.stage || 'LEAD_SOURCED',
          status: f.status || 'Sourced',
          documents: (f.documents && typeof f.documents === 'object' && !Array.isArray(f.documents)) ? f.documents : {},
          timeline: Array.isArray(f.timeline) ? f.timeline : [],
          cancellationReason: f.cancellation_reason || null,
          cancelledAt: f.cancelled_at || null,
          cancelledBy: f.cancelled_by ? (typeof f.cancelled_by === 'object' ? f.cancelled_by.name || f.cancelled_by.id : String(f.cancelled_by)) : null,
          createdAt: f.created_at,
          updatedAt: f.updated_at
        }));
      }
    } catch (err) {
      console.warn('[customerFileService] Direct fetch exception:', err);
      if (throwOnError) throw err;
    }

    return [];
  },

  /**
   * Save / Upsert customer file via secure /api/customer-files endpoint
   */
  async saveCustomerFile(file) {
    if (!file || !file.id) return { success: false, error: 'File ID required' };

    try {
      const res = await fetch('/api/customer-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'save', file })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) return json;
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `HTTP ${res.status}: Failed to save customer file.` };
    } catch (apiErr) {
      console.error('[customerFileService] API save error:', apiErr);
      return { success: false, error: apiErr.message || 'Failed to save customer file.' };
    }
  },

  /**
   * Update customer file status, fields, or timeline via secure /api/customer-files endpoint
   */
  async updateCustomerFile(fileId, updates) {
    if (!fileId) return { success: false, error: 'File ID required' };

    try {
      const res = await fetch('/api/customer-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'update', fileId, updates })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) return json;
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `HTTP ${res.status}: Failed to update customer file.` };
    } catch (apiErr) {
      console.error('[customerFileService] API update error:', apiErr);
      return { success: false, error: apiErr.message || 'Failed to update customer file.' };
    }
  },

  /**
   * Cancel customer file with reason via secure /api/customer-files endpoint
   */
  async cancelCustomerFile(fileId, reason = 'Cancelled by user', cancelledBy = 'Admin Desk') {
    if (!fileId) return { success: false, error: 'File ID required' };

    try {
      const res = await fetch('/api/customer-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'cancel', fileId, reason, cancelledBy })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) return json;
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `HTTP ${res.status}: Failed to cancel customer file.` };
    } catch (apiErr) {
      console.error('[customerFileService] API cancel error:', apiErr);
      return { success: false, error: apiErr.message || 'Failed to cancel customer file.' };
    }
  },

  /**
   * Restore a cancelled customer file back to active Sourced pipeline (Within 14 days)
   */
  async restoreCustomerFile(fileId, fileData = null) {
    if (!fileId) return { success: false, error: 'File ID required' };

    // Client-side 14-day validation
    if (fileData?.cancelledAt) {
      const retention = getCancellationRetentionStatus(fileData.cancelledAt);
      if (retention.isExpired) {
        return { success: false, error: 'Restoration locked: The 14-day recovery window for this file has expired.' };
      }
    }

    try {
      const res = await fetch('/api/customer-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'restore', fileId })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) return json;
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `HTTP ${res.status}: Failed to restore customer file.` };
    } catch (apiErr) {
      console.error('[customerFileService] API restore error:', apiErr);
      return { success: false, error: apiErr.message || 'Failed to restore customer file.' };
    }
  },

  /**
   * Delete customer file and purge documents via secure /api/customer-files endpoint
   */
  async deleteCustomerFile(fileId, fileData = null) {
    if (!fileId) return { success: false, error: 'File ID required' };

    try {
      const res = await fetch('/api/customer-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'delete', fileId })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) return { success: true, fileId };
      }
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `HTTP ${res.status}: Failed to delete customer file.` };
    } catch (apiErr) {
      console.error('[customerFileService] API delete error:', apiErr);
      return { success: false, error: apiErr.message || 'Failed to delete customer file.' };
    }
  }
};

import { createClient } from '@supabase/supabase-js';
import { verifyJwt } from './_lib/jwt.js';
import { cacheAside, redisDel } from './_lib/redis.js';
import { getClientIp, checkDistributedRateLimit } from './_lib/rateLimiter.js';

function parseCookies(cookieHeader = '') {
  const out = {};
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

function getDb() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase database configuration missing.');
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

function mapDbToFrontend(f) {
  return {
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
    staffId: f.staff_id || 'STF-001',
    staffName: f.staff_name || 'Jayesh Patel',
    financeType: f.finance_type || 'CASH',
    paymentMode: f.finance_type || 'CASH',
    loanBank: f.loan_bank,
    loanAccountNo: f.loan_account_no,
    loanRefNo: f.loan_account_no,
    stage: f.stage || 'LEAD_SOURCED',
    currentStage: f.stage || 'LEAD_SOURCED',
    status: f.status || 'Sourced',
    documents: f.documents || {},
    timeline: Array.isArray(f.timeline) ? f.timeline : [],
    createdAt: f.created_at,
    updatedAt: f.updated_at
  };
}

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const jwt = verifyJwt(cookies.sunvine_auth_token);

  if (!jwt.valid) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const clientIp = getClientIp(req);
  const rateLimit = await checkDistributedRateLimit(`cust_files_${clientIp}`, { maxAttempts: 100, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please wait.' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  // ── GET: Fetch All Customer Files ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data: rows, error } = await db
        .from('customer_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[api/customer-files] Supabase query error:', error);
        return res.status(500).json({ error: error.message });
      }

      const formatted = (rows || []).map(mapDbToFrontend);
      return res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      console.error('[api/customer-files] GET error:', err);
      return res.status(500).json({ error: 'Failed to fetch customer files.' });
    }
  }

  // ── POST: Actions (save, update, delete) ───────────────────────────────────
  if (req.method === 'POST') {
    const { action, file, fileId, updates } = req.body || {};

    if (action === 'save' && file) {
      const payload = {
        id: file.id,
        customer_name: file.customerName || file.customer_name || 'Customer',
        phone: file.phone || '',
        address: file.address || '',
        city: file.city || 'Ahmedabad',
        discom: file.discom || file.discomCircle || 'UGVCL',
        consumer_no: file.consumerNo || file.consumerNumber || file.consumer_no || '',
        sanctioned_load_kw: Number(file.sanctionedLoadKw || file.sanctioned_load_kw) || 6.0,
        solar_system_kw: Number(file.solarSystemKw || file.solar_system_kw) || 5.0,
        roof_type: file.roofType || file.roof_type || 'Flat RCC',
        source_type: file.sourceType || file.source || file.source_type || 'DIRECT_STAFF',
        dealer_id: file.dealerId || file.dealer_id || null,
        dealer_name: file.dealerName || file.dealer_name || null,
        staff_id: file.staffId || file.staff_id || 'STF-001',
        staff_name: file.staffName || file.staff_name || 'Jayesh Patel',
        finance_type: file.financeType || file.paymentMode || file.finance_type || 'CASH',
        loan_bank: file.loanBank || file.loan_bank || null,
        loan_account_no: file.loanAccountNo || file.loanRefNo || file.loan_account_no || null,
        stage: file.stage || file.currentStage || 'LEAD_SOURCED',
        status: file.status || 'Sourced',
        documents: file.documents || {},
        timeline: Array.isArray(file.timeline) ? file.timeline : [],
        updated_at: new Date().toISOString()
      };

      try {
        const { data, error } = await db
          .from('customer_files')
          .upsert([payload], { onConflict: 'id' })
          .select()
          .single();

        if (error) {
          console.error('[api/customer-files] Save DB error:', error);
          return res.status(400).json({ error: error.message });
        }

        await redisDel('customer_files:all');
        return res.status(200).json({ success: true, data: mapDbToFrontend(data) });
      } catch (err) {
        console.error('[api/customer-files] Save exception:', err);
        return res.status(500).json({ error: 'Failed to save customer file.' });
      }
    }

    if (action === 'update' && fileId && updates) {
      const payload = {
        updated_at: new Date().toISOString()
      };

      if (updates.customerName !== undefined || updates.customer_name !== undefined) {
        payload.customer_name = updates.customerName || updates.customer_name;
      }
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.address !== undefined) payload.address = updates.address;
      if (updates.city !== undefined) payload.city = updates.city;
      if (updates.discom !== undefined || updates.discomCircle !== undefined) {
        payload.discom = updates.discom || updates.discomCircle;
      }
      if (updates.consumerNo !== undefined || updates.consumerNumber !== undefined || updates.consumer_no !== undefined) {
        payload.consumer_no = updates.consumerNo || updates.consumerNumber || updates.consumer_no;
      }
      if (updates.sanctionedLoadKw !== undefined || updates.sanctioned_load_kw !== undefined) {
        payload.sanctioned_load_kw = Number(updates.sanctionedLoadKw || updates.sanctioned_load_kw) || 0;
      }
      if (updates.solarSystemKw !== undefined || updates.solar_system_kw !== undefined) {
        payload.solar_system_kw = Number(updates.solarSystemKw || updates.solar_system_kw) || 0;
      }
      if (updates.roofType !== undefined || updates.roof_type !== undefined) {
        payload.roof_type = updates.roofType || updates.roof_type;
      }
      if (updates.sourceType !== undefined || updates.source !== undefined || updates.source_type !== undefined) {
        payload.source_type = updates.sourceType || updates.source || updates.source_type;
      }
      if (updates.dealerId !== undefined || updates.dealer_id !== undefined) {
        payload.dealer_id = updates.dealerId !== undefined ? updates.dealerId : updates.dealer_id;
      }
      if (updates.dealerName !== undefined || updates.dealer_name !== undefined) {
        payload.dealer_name = updates.dealerName !== undefined ? updates.dealerName : updates.dealer_name;
      }
      if (updates.staffId !== undefined || updates.staff_id !== undefined) {
        payload.staff_id = updates.staffId !== undefined ? updates.staffId : updates.staff_id;
      }
      if (updates.staffName !== undefined || updates.staff_name !== undefined) {
        payload.staff_name = updates.staffName !== undefined ? updates.staffName : updates.staff_name;
      }
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.stage !== undefined || updates.currentStage !== undefined) {
        payload.stage = updates.stage || updates.currentStage;
      }
      if (updates.timeline !== undefined) payload.timeline = updates.timeline;
      if (updates.documents !== undefined) payload.documents = updates.documents;
      if (updates.loanBank !== undefined || updates.loan_bank !== undefined) {
        payload.loan_bank = updates.loanBank !== undefined ? updates.loanBank : updates.loan_bank;
      }
      if (updates.loanAccountNo !== undefined || updates.loanRefNo !== undefined || updates.loan_account_no !== undefined) {
        payload.loan_account_no = updates.loanAccountNo || updates.loanRefNo || updates.loan_account_no;
      }
      if (updates.financeType !== undefined || updates.paymentMode !== undefined || updates.finance_type !== undefined) {
        payload.finance_type = updates.financeType || updates.paymentMode || updates.finance_type;
      }

      try {
        const { data, error } = await db
          .from('customer_files')
          .update(payload)
          .eq('id', fileId)
          .select()
          .single();

        if (error) {
          console.error('[api/customer-files] Update DB error:', error);
          return res.status(400).json({ error: error.message });
        }

        await redisDel('customer_files:all');
        return res.status(200).json({ success: true, data: mapDbToFrontend(data) });
      } catch (err) {
        console.error('[api/customer-files] Update exception:', err);
        return res.status(500).json({ error: 'Failed to update customer file.' });
      }
    }

    if (action === 'delete' && fileId) {
      try {
        const { error } = await db
          .from('customer_files')
          .delete()
          .eq('id', fileId);

        if (error) {
          console.error('[api/customer-files] Delete DB error:', error);
          return res.status(400).json({ error: error.message });
        }

        await redisDel('customer_files:all');
        return res.status(200).json({ success: true, fileId });
      } catch (err) {
        console.error('[api/customer-files] Delete exception:', err);
        return res.status(500).json({ error: 'Failed to delete customer file.' });
      }
    }

    return res.status(400).json({ error: 'Invalid action or missing parameters.' });
  }

  return res.status(405).json({ error: 'Method Not Allowed.' });
}

import { createClient } from '@supabase/supabase-js';
import { requireUser } from '../_lib/requireAuth.js';
import { applyCors, getCorsHeaders, handleOptionsResponse } from '../_lib/cors.js';
import { cacheAside, redisDel } from '../_lib/redis.js';
import { getClientIp, checkDistributedRateLimit } from '../_lib/rateLimiter.js';
import { syncFile, computeThreadNotification, setEnv as setSlackEnv } from '../_lib/slackSync.js';
import { getR2Client } from '../_lib/r2.js';

let _env = null;
function getDb(env) {
  const e = env || _env;
  const supabaseUrl = e?.SUPABASE_URL || e?.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = e?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase database configuration missing.');
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);
const MAX_DOC_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB



export function extractAllDocPaths(documents) {
  if (!documents || typeof documents !== 'object') return [];
  const paths = [];
  for (const key of Object.keys(documents)) {
    const val = documents[key];
    if (!val) continue;
    if (typeof val === 'string') {
      paths.push(val);
    } else if (Array.isArray(val)) {
      val.forEach(item => {
        if (typeof item === 'string') paths.push(item);
        else if (item?.url) paths.push(item.url);
        else if (item?.path) paths.push(item.path);
      });
    } else if (typeof val === 'object') {
      if (val.url) paths.push(val.url);
      if (val.path) paths.push(val.path);
      if (Array.isArray(val.files)) {
        val.files.forEach(f => {
          if (typeof f === 'string') paths.push(f);
          else if (f?.url) paths.push(f.url);
          else if (f?.path) paths.push(f.path);
        });
      }
    }
  }
  return [...new Set(paths.map(p => p.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\/+/, '')).filter(Boolean))];
}

export async function validateRegisteredDocuments(documents, bucket) {
  const docPaths = extractAllDocPaths(documents);
  if (!docPaths || docPaths.length === 0) return { valid: true };

  const r2 = getR2Client(_env);
  if (!r2) return { valid: true };

  try {
    for (const key of docPaths) {
      if (key.startsWith('http://') || key.startsWith('https://')) continue;
      try {
        const headRes = await r2.headObject(key);
        if (headRes.ok) {
          const size = parseInt(headRes.headers.get('content-length') || '0', 10);
          const type = (headRes.headers.get('content-type') || '').toLowerCase();

          if (size > MAX_DOC_SIZE_BYTES) {
            await r2.deleteObject(key).catch(() => null);
            return { valid: false, error: `Document "${key}" exceeds maximum 2MB size limit (${Math.round(size / 1024)} KB).` };
          }

          if (type && !ALLOWED_MIME_TYPES.has(type)) {
            await r2.deleteObject(key).catch(() => null);
            return { valid: false, error: `Document "${key}" has invalid MIME type "${type}". Only PDF and images are allowed.` };
          }
        }
      } catch (headErr) {
        console.warn(`[customer-files] HeadObject check warning for ${key}:`, headErr.message);
      }
    }
  } catch (err) {
    console.warn('[customer-files] Document HEAD validation error:', err?.message);
  }

  return { valid: true };
}

async function deleteR2Files(keys, bucket) {
  if (!keys || keys.length === 0) return;
  const r2 = getR2Client(_env);
  if (!r2) return;

  try {
    await Promise.allSettled(
      keys.map(key => r2.deleteObject(key))
    );
  } catch (err) {
    console.warn('[customer-files] R2 document purge notice:', err?.message);
  }
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
    documents: f.documents || {},
    timeline: Array.isArray(f.timeline) ? f.timeline : [],
    cancellationReason: f.cancellation_reason || null,
    cancelledAt: f.cancelled_at || null,
    cancelledBy: f.cancelled_by ? (typeof f.cancelled_by === 'object' ? f.cancelled_by.name || f.cancelled_by.id : String(f.cancelled_by)) : null,
    createdAt: f.created_at,
    updatedAt: f.updated_at
  };
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // SEC-011: Require authenticated user
  const user = await requireUser(req, res);
  if (!user) return;

  const clientIp = getClientIp(req);
  const rateLimit = await checkDistributedRateLimit(_env, `cust_files_${clientIp}`, { maxAttempts: 100, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please wait.' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const isDealer = user.role === 'dealer';
  const dealerId = user.dealer_id || user.id;

  // ── GET: Fetch Customer Files (Scoped by dealer_id if dealer, Paginated) ───
  if (req.method === 'GET') {
    try {
      const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 100, 1), 100);
      const offset = Math.max(parseInt(req.query?.offset, 10) || 0, 0);

      // 14-Day Retention Check: purge R2 documents for cancelled files older than 14 days
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      let expQuery = db
        .from('customer_files')
        .select('id, documents, timeline')
        .eq('status', 'Cancelled')
        .lt('cancelled_at', fourteenDaysAgo);

      if (isDealer) {
        expQuery = expQuery.eq('dealer_id', dealerId);
      }

      const { data: expiredFiles } = await expQuery;

      if (Array.isArray(expiredFiles) && expiredFiles.length > 0) {
        for (const exp of expiredFiles) {
          const docKeys = extractAllDocPaths(exp.documents);
          if (docKeys.length > 0) {
            await deleteR2Files(docKeys);
            const expiredPurgeNote = {
              title: 'Uploaded Documents Removed',
              description: 'Uploaded customer documents were permanently deleted after the 14-day recovery period ended.',
              timestamp: new Date().toISOString(),
              stage: 'CANCELLED',
              author: 'System'
            };
            const updatedTimeline = Array.isArray(exp.timeline) ? [...exp.timeline, expiredPurgeNote] : [expiredPurgeNote];
            await db.from('customer_files').update({
              documents: {},
              timeline: updatedTimeline,
              updated_at: new Date().toISOString()
            }).eq('id', exp.id);
          }
        }
      }

      let queryBuilder = db
        .from('customer_files')
        .select('*', { count: 'exact' });

      // Scope to dealer
      if (isDealer) {
        queryBuilder = queryBuilder.eq('dealer_id', dealerId);
      }

      queryBuilder = queryBuilder
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: rows, count, error } = await queryBuilder;

      if (error) {
        console.error('[api/customer-files] Supabase query error:', error);
        return res.status(500).json({ error: error.message });
      }

      const formatted = (rows || []).map(mapDbToFrontend);
      return res.status(200).json({
        success: true,
        data: formatted,
        total: count !== null && count !== undefined ? count : formatted.length,
        limit,
        offset
      });
    } catch (err) {
      console.error('[api/customer-files] GET error:', err);
      return res.status(500).json({ error: 'Failed to fetch customer files.' });
    }
  }

  // ── POST: Actions (save, update, cancel, restore, delete) ─────────────────
  if (req.method === 'POST') {
    const { action, file, fileId, updates } = req.body || {};

    if (action === 'save' && file) {
      // Robust collision-free ID generation if id is omitted or temporary
      let assignedId = file.id;
      if (!assignedId || assignedId.trim() === '') {
        const year = new Date().getFullYear();
        const randPart = Math.random().toString(36).substring(2, 7).toUpperCase();
        assignedId = `FIL-${year}-${randPart}`;
      }

      // Prevent dealer from spoofing or overwriting another dealer's file
      if (isDealer && assignedId) {
        const { data: existingFile } = await db.from('customer_files').select('dealer_id').eq('id', assignedId).single();
        if (existingFile && existingFile.dealer_id && existingFile.dealer_id !== dealerId) {
          return res.status(403).json({ error: 'Forbidden: You cannot modify customer files belonging to another dealer.' });
        }
      }

      const payload = {
        id: assignedId,
        customer_name: file.customerName || file.customer_name || 'Customer',
        phone: file.phone || '',
        address: file.address || '',
        city: file.city || 'Ahmedabad',
        discom: file.discom || file.discomCircle || 'UGVCL',
        consumer_no: file.consumerNo || file.consumerNumber || file.consumer_no || '',
        sanctioned_load_kw: Number(file.sanctionedLoadKw || file.sanctioned_load_kw) || 6.0,
        solar_system_kw: Number(file.solarSystemKw || file.solar_system_kw) || 5.0,
        roof_type: file.roofType || file.roof_type || 'Flat RCC',
        source_type: isDealer ? 'DEALER' : (file.sourceType || file.source || file.source_type || 'DIRECT_STAFF'),
        dealer_id: isDealer ? dealerId : (file.dealerId || file.dealer_id || null),
        dealer_name: isDealer ? (user.firmName || user.name || 'Authorized Dealer') : (file.dealerName || file.dealer_name || null),
        staff_id: file.staffId || file.staff_id || (isDealer || file.sourceType === 'DEALER' || file.source === 'DEALER' ? 'STF-DIRECT' : 'STF-801'),
        staff_name: (file.staffId === 'STF-DIRECT' || file.staff_id === 'STF-DIRECT' || ((!file.staffId && !file.staff_id) && (isDealer || file.sourceType === 'DEALER' || file.source === 'DEALER')))
          ? 'Direct to Company (HQ Desk)'
          : ((file.staffName === 'Jayesh Patel' || file.staff_name === 'Jayesh Patel') ? 'Sunvine Sales Staff' : (file.staffName || file.staff_name || 'Sunvine Sales Staff')),
        finance_type: file.financeType || file.paymentMode || file.finance_type || 'CASH',
        loan_bank: file.loanBank || file.loan_bank || null,
        stage: file.stage || file.currentStage || 'LEAD_SOURCED',
        status: file.status || 'Sourced',
        documents: file.documents || {},
        timeline: Array.isArray(file.timeline) ? file.timeline : [],
        updated_at: new Date().toISOString()
      };

      // ITEM-7: HEAD validate registered documents (size and MIME type verification)
      if (file.documents) {
        const docCheck = await validateRegisteredDocuments(file.documents);
        if (!docCheck.valid) {
          return res.status(422).json({ error: docCheck.error });
        }
      }

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

        await redisDel(_env, 'customer_files:all');

        // Slack thread sync: single main card creation (safe, never fails the HTTP response)
        const callerActor = user.name || user.firmName || user.id || (isDealer ? 'Authorized Dealer' : 'Staff Desk');
        try {
          await syncFile(data.id, { actor: callerActor });
        } catch (slackErr) {
          console.warn('[api/customer-files] Slack sync notice on save:', slackErr.message);
        }

        return res.status(200).json({ success: true, data: mapDbToFrontend(data) });
      } catch (err) {
        console.error('[api/customer-files] Save exception:', err);
        return res.status(500).json({ error: 'Failed to save customer file.' });
      }
    }

    if (action === 'update' && fileId && updates) {
      // SEC-011: Strip dealer_id from updates unless caller role is admin
      if (user.role !== 'admin') {
        delete updates.dealerId;
        delete updates.dealer_id;
      }

      // ITEM-7: HEAD validate updated documents
      if (updates.documents) {
        const docCheck = await validateRegisteredDocuments(updates.documents);
        if (!docCheck.valid) {
          return res.status(422).json({ error: docCheck.error });
        }
      }

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
      if (user.role === 'admin' && (updates.dealerId !== undefined || updates.dealer_id !== undefined)) {
        payload.dealer_id = updates.dealerId !== undefined ? updates.dealerId : updates.dealer_id;
      }
      if (user.role === 'admin' && (updates.dealerName !== undefined || updates.dealer_name !== undefined)) {
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
      if (updates.financeType !== undefined || updates.paymentMode !== undefined || updates.finance_type !== undefined) {
        payload.finance_type = updates.financeType || updates.paymentMode || updates.finance_type;
      }

      try {
        // Fetch existing row for diff calculation & thread notifications
        let oldRowQuery = db.from('customer_files').select('*').eq('id', fileId);
        if (isDealer) {
          oldRowQuery = oldRowQuery.eq('dealer_id', dealerId);
        }
        const { data: oldRow } = await oldRowQuery.maybeSingle();

        let updateQuery = db
          .from('customer_files')
          .update(payload)
          .eq('id', fileId);

        // SEC-011: Scoped to dealer_id
        if (isDealer) {
          updateQuery = updateQuery.eq('dealer_id', dealerId);
        }

        const { data, error } = await updateQuery.select().single();

        if (error || !data) {
          if (!data && !error) {
            return res.status(403).json({ error: 'Customer file not found or unauthorized.' });
          }
          console.error('[api/customer-files] Update DB error:', error);
          return res.status(400).json({ error: error?.message || 'Update failed.' });
        }

        await redisDel(_env, 'customer_files:all');

        // Slack thread sync: compute diff for thread comments & update main card
        const callerActor = user.name || user.firmName || user.id || (isDealer ? 'Authorized Dealer' : 'Staff Desk');
        const threadText = computeThreadNotification(oldRow, data, callerActor);
        try {
          await syncFile(data.id, { threadText, actor: callerActor });
        } catch (slackErr) {
          console.warn('[api/customer-files] Slack sync notice on update:', slackErr.message);
        }

        return res.status(200).json({ success: true, data: mapDbToFrontend(data) });
      } catch (err) {
        console.error('[api/customer-files] Update exception:', err);
        return res.status(500).json({ error: 'Failed to update customer file.' });
      }
    }

    if (action === 'cancel' && fileId) {
      const { reason, remarks, customRemarks, cancelledBy } = req.body || {};
      const noteText = (remarks || customRemarks || '').trim();
      let finalReason = reason || '';
      if (!finalReason && noteText) {
        finalReason = noteText;
      } else if (noteText && !finalReason.includes(noteText)) {
        finalReason = `${finalReason} — Remarks: ${noteText}`;
      }
      finalReason = finalReason || 'Cancelled by user';

      const actor = cancelledBy || user.name || user.id || (isDealer ? 'Dealer Desk' : 'Admin Desk');
      const cancelNote = {
        title: 'Customer File Cancelled',
        description: `File cancelled: ${finalReason}`,
        timestamp: new Date().toISOString(),
        stage: 'CANCELLED',
        author: actor,
        notes: finalReason
      };

      try {
        // Fetch current timeline first with dealer check
        let selQuery = db.from('customer_files').select('timeline, dealer_id').eq('id', fileId);
        if (isDealer) {
          selQuery = selQuery.eq('dealer_id', dealerId);
        }
        const { data: existing, error: selErr } = await selQuery.single();

        if (selErr || !existing) {
          return res.status(403).json({ error: 'Customer file not found or unauthorized.' });
        }

        const updatedTimeline = Array.isArray(existing?.timeline) ? [...existing.timeline, cancelNote] : [cancelNote];

        const payload = {
          status: 'Cancelled',
          stage: 'CANCELLED',
          cancellation_reason: finalReason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: actor,
          timeline: updatedTimeline,
          updated_at: new Date().toISOString()
        };

        let cancelQuery = db
          .from('customer_files')
          .update(payload)
          .eq('id', fileId);

        if (isDealer) {
          cancelQuery = cancelQuery.eq('dealer_id', dealerId);
        }

        const { data, error } = await cancelQuery.select().single();

        if (error || !data) {
          console.error('[api/customer-files] Cancel DB error:', error);
          return res.status(400).json({ error: error?.message || 'Cancel failed.' });
        }

        await redisDel(_env, 'customer_files:all');

        // Slack thread sync: update main card status to Cancelled + post thread line
        const threadText = `Application Cancelled: ${finalReason} (by ${actor})`;
        try {
          await syncFile(data.id, { threadText, actor, force: true });
        } catch (slackErr) {
          console.warn('[api/customer-files] Slack sync notice on cancel:', slackErr.message);
        }

        return res.status(200).json({ success: true, data: mapDbToFrontend(data) });
      } catch (err) {
        console.error('[api/customer-files] Cancel exception:', err);
        return res.status(500).json({ error: 'Failed to cancel customer file.' });
      }
    }

    if (action === 'restore' && fileId) {
      try {
        let selQuery = db
          .from('customer_files')
          .select('cancelled_at, timeline, dealer_id')
          .eq('id', fileId);

        if (isDealer) {
          selQuery = selQuery.eq('dealer_id', dealerId);
        }

        const { data: existing, error: selErr } = await selQuery.single();

        if (selErr || !existing) {
          return res.status(403).json({ error: 'Customer file not found or unauthorized.' });
        }

        // 14-day restoration window enforcement
        if (existing?.cancelled_at) {
          const diffMs = Date.now() - new Date(existing.cancelled_at).getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 14) {
            return res.status(400).json({
              error: 'Restoration locked: The 14-day recovery window for this cancelled file has expired. Documents have been purged.'
            });
          }
        }

        const restoreNote = {
          title: 'Customer File Restored',
          description: `File restored to active Sourced pipeline by ${user.name || user.id || 'User'}`,
          timestamp: new Date().toISOString(),
          stage: 'LEAD_SOURCED',
          author: user.name || user.id || 'User'
        };

        const updatedTimeline = Array.isArray(existing?.timeline) ? [...existing.timeline, restoreNote] : [restoreNote];

        const payload = {
          status: 'Sourced',
          stage: 'LEAD_SOURCED',
          cancellation_reason: null,
          cancelled_at: null,
          cancelled_by: null,
          timeline: updatedTimeline,
          updated_at: new Date().toISOString()
        };

        let restoreQuery = db
          .from('customer_files')
          .update(payload)
          .eq('id', fileId);

        if (isDealer) {
          restoreQuery = restoreQuery.eq('dealer_id', dealerId);
        }

        const { data, error } = await restoreQuery.select().single();

        if (error || !data) {
          console.error('[api/customer-files] Restore DB error:', error);
          return res.status(400).json({ error: error?.message || 'Restore failed.' });
        }

        await redisDel(_env, 'customer_files:all');

        // Slack thread sync: restore main card status to active + post thread line
        const restoreActor = user.name || user.firmName || user.id || 'User';
        const threadText = `Application Restored to active pipeline by ${restoreActor}`;
        try {
          await syncFile(data.id, { threadText, actor: restoreActor, force: true });
        } catch (slackErr) {
          console.warn('[api/customer-files] Slack sync notice on restore:', slackErr.message);
        }

        return res.status(200).json({ success: true, data: mapDbToFrontend(data) });
      } catch (err) {
        console.error('[api/customer-files] Restore exception:', err);
        return res.status(500).json({ error: 'Failed to restore customer file.' });
      }
    }

    if (action === 'delete' && fileId) {
      // Super Admin check for hard permanent purge
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Permission denied. Only Super Admin can permanently delete files.' });
      }

      try {
        // Fetch file to purge all attached documents from Cloudflare R2 before removing row
        let selQuery = db
          .from('customer_files')
          .select('documents, dealer_id')
          .eq('id', fileId);

        if (isDealer) {
          selQuery = selQuery.eq('dealer_id', dealerId);
        }

        const { data: fileToDelete } = await selQuery.single();

        if (fileToDelete?.documents) {
          const docKeys = extractAllDocPaths(fileToDelete.documents);
          if (docKeys.length > 0) {
            await deleteR2Files(docKeys);
          }
        }

        let delQuery = db
          .from('customer_files')
          .delete()
          .eq('id', fileId);

        if (isDealer) {
          delQuery = delQuery.eq('dealer_id', dealerId);
        }

        const { error } = await delQuery;

        if (error) {
          console.error('[api/customer-files] Delete DB error:', error);
          return res.status(400).json({ error: error.message });
        }

        await redisDel(_env, 'customer_files:all');
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

export async function onRequest(context) {
  const { request, env } = context;
  _env = env;
  setSlackEnv(env);
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return handleOptionsResponse(request, env);
  }

  const resObj = {
    _status: 200,
    _headers: new Headers(corsHeaders),
    status(s) { this._status = s; return this; },
    setHeader(k, v) { this._headers.set(k, v); return this; },
    json(data) {
      return Response.json(data, {
        status: this._status,
        headers: this._headers
      });
    },
    end(b = null) {
      return new Response(b, {
        status: this._status,
        headers: this._headers
      });
    }
  };

  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());

  let body = {};
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.clone().json();
    } catch (_) {}
  }

  const reqObj = {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    query,
    body,
    rawRequest: request
  };

  const { payload: user, errorResponse } = await requireUser(request, env);
  if (errorResponse) {
    for (const [k, v] of corsHeaders.entries()) errorResponse.headers.set(k, v);
    return errorResponse;
  }

  return await handler(reqObj, resObj);
}

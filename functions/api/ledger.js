import { createClient } from '@supabase/supabase-js';
import { requireUser } from '../_lib/requireAuth.js';
import { getCorsHeaders, handleOptionsResponse } from '../_lib/cors.js';
import { checkDistributedRateLimit, getClientIp } from '../_lib/rateLimiter.js';

function getDb(env) {
  const supabaseUrl = env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL || process.env?.VITE_SUPABASE_URL;
  const serviceKey = env?.SUPABASE_SERVICE_ROLE_KEY || process.env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error('[FATAL] SUPABASE_URL is required.');
  if (!serviceKey) throw new Error('[FATAL] SUPABASE_SERVICE_ROLE_KEY is required.');
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return handleOptionsResponse(request, env);
  }

  // 1. Authenticate user
  const { payload: user, errorResponse } = await requireUser(request, env);
  if (errorResponse) {
    for (const [k, v] of corsHeaders.entries()) errorResponse.headers.set(k, v);
    return errorResponse;
  }

  const role = user.role;
  const authUserId = user.id;
  const authDealerId = user.dealer_id || user.id;

  // 2. Rate limit
  const ip = getClientIp(request);
  const rate = await checkDistributedRateLimit(env, `ledger_${ip}`, { maxAttempts: 120, windowMs: 60 * 1000 });
  if (!rate.allowed) {
    return Response.json({ error: 'Too many ledger requests. Please wait.' }, { status: 429, headers: corsHeaders });
  }

  let db;
  try {
    db = getDb(env);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 503, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // ── GET: Retrieve Ledger Entries ──────────────────────────────────────────
  if (request.method === 'GET') {
    try {
      let targetDealerId = url.searchParams.get('dealer_id');

      // If dealer is requesting, strictly scope to their own ID
      if (role === 'dealer') {
        targetDealerId = authDealerId || authUserId;
      }

      let query = db
        .from('dealer_ledger_entries')
        .select('*')
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (targetDealerId && targetDealerId !== 'all') {
        query = query.eq('dealer_id', targetDealerId);
      }

      const { data, error } = await query;
      if (error) {
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
      }

      // Compute running balance & summary
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

      return Response.json({
        success: true,
        entries: entriesWithBalance.reverse(),
        summary: {
          totalDebit,
          totalCredit,
          netBalance: totalDebit - totalCredit,
          totalEntries: entriesWithBalance.length
        }
      }, { status: 200, headers: corsHeaders });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }

  // ── POST: Create Voucher Entry ─────────────────────────────────────────────
  if (request.method === 'POST') {
    if (role !== 'admin' && role !== 'staff') {
      return Response.json({ error: 'Only authorized administrative staff can create vouchers.' }, { status: 403, headers: corsHeaders });
    }

    try {
      let body = {};
      try {
        body = await request.json();
      } catch (_) {}

      const {
        dealer_id,
        dealer_code,
        dealer_name,
        customer_file_id,
        customer_name,
        entry_date,
        entry_type,
        category,
        amount,
        payment_mode,
        reference_no,
        narration,
        proof_url
      } = body;

      if (!dealer_id || !entry_type || !category || !amount || !narration) {
        return Response.json({ error: 'dealer_id, entry_type, category, amount, and narration are required.' }, { status: 400, headers: corsHeaders });
      }

      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return Response.json({ error: 'amount must be a positive number.' }, { status: 400, headers: corsHeaders });
      }

      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const voucherNo = `VCH-${year}-${Date.now().toString(36).toUpperCase().slice(-4)}-${rand}`;

      const voucherPayload = {
        voucher_no: voucherNo,
        dealer_id,
        dealer_code: dealer_code || '',
        dealer_name: dealer_name || 'Dealer Partner',
        customer_file_id: customer_file_id || null,
        customer_name: customer_name || null,
        entry_date: entry_date || new Date().toISOString().split('T')[0],
        entry_type: String(entry_type).toUpperCase(),
        category,
        amount: numAmount,
        payment_mode: payment_mode || 'BANK_TRANSFER',
        reference_no: reference_no || '',
        narration: String(narration).trim(),
        proof_url: proof_url || null,
        created_by: user.name || 'Administrator'
      };

      const { data, error } = await db
        .from('dealer_ledger_entries')
        .insert([voucherPayload])
        .select()
        .single();

      if (error) {
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
      }

      return Response.json({ success: true, entry: data }, { status: 201, headers: corsHeaders });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }

  // ── DELETE: Delete Voucher (Admin only) ───────────────────────────────────
  if (request.method === 'DELETE') {
    if (role !== 'admin') {
      return Response.json({ error: 'Only Super Administrator can reverse/delete vouchers.' }, { status: 403, headers: corsHeaders });
    }

    try {
      let id = url.searchParams.get('id');
      if (!id) {
        try {
          const body = await request.json();
          id = body?.id;
        } catch (_) {}
      }

      if (!id) {
        return Response.json({ error: 'Voucher id required.' }, { status: 400, headers: corsHeaders });
      }

      const { error } = await db
        .from('dealer_ledger_entries')
        .delete()
        .eq('id', id);

      if (error) {
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
      }

      return Response.json({ success: true, message: 'Voucher deleted.' }, { status: 200, headers: corsHeaders });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }

  return Response.json({ error: 'Method Not Allowed' }, { status: 405, headers: corsHeaders });
}

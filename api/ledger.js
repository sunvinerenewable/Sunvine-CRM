import { createClient } from '@supabase/supabase-js';
import { verifyJwt, extractAuthToken } from './_lib/jwt.js';
import { getClientIp, checkRateLimit } from './_lib/rateLimiter.js';

function getDb() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error('[FATAL] SUPABASE_URL env var is required.');
  if (!serviceKey) throw new Error('[FATAL] SUPABASE_SERVICE_ROLE_KEY is required.');
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  // CORS & Preflight
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = extractAuthToken(req);
  const jwtResult = verifyJwt(token);
  if (!jwtResult.valid) {
    return res.status(401).json({ error: 'Authentication required for financial ledger.' });
  }

  const { role, id: authUserId, dealer_id: authDealerId } = jwtResult.payload;

  let db;
  try {
    db = getDb();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, { maxAttempts: 120, windowMs: 60 * 1000 });
  if (!rate.allowed) return res.status(429).json({ error: 'Too many ledger requests. Please wait.' });

  // ── GET: Retrieve Ledger Entries ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      let targetDealerId = req.query?.dealer_id;

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
      if (error) return res.status(500).json({ error: error.message });

      // Compute running balance & summary
      let runningBalance = 0; // Positive = Dealer owes Sunvine (Debit), Negative = Sunvine owes Dealer (Credit)
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

      return res.status(200).json({
        success: true,
        entries: entriesWithBalance.reverse(), // latest first for display
        summary: {
          totalDebit,
          totalCredit,
          netBalance: totalDebit - totalCredit, // > 0 = Receivable (Lene Baki), < 0 = Payable
          totalEntries: entriesWithBalance.length
        }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: Create Voucher Entry ─────────────────────────────────────────────
  if (req.method === 'POST') {
    // Only Admin or Verification staff can create financial vouchers
    if (role !== 'admin' && role !== 'staff') {
      return res.status(403).json({ error: 'Only authorized administrative staff can create vouchers.' });
    }

    try {
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
      } = req.body || {};

      if (!dealer_id || !entry_type || !category || !amount || !narration) {
        return res.status(400).json({ error: 'dealer_id, entry_type, category, amount, and narration are required.' });
      }

      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number.' });
      }

      // Generate unique voucher number: VCH-YYYY-XXXX
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
        created_by: jwtResult.payload.name || 'Administrator'
      };

      const { data, error } = await db
        .from('dealer_ledger_entries')
        .insert([voucherPayload])
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(201).json({ success: true, entry: data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE: Delete Voucher (Admin only) ───────────────────────────────────
  if (req.method === 'DELETE') {
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only Super Administrator can reverse/delete vouchers.' });
    }

    try {
      const id = req.query?.id || req.body?.id;
      if (!id) return res.status(400).json({ error: 'Voucher id required.' });

      const { error } = await db
        .from('dealer_ledger_entries')
        .delete()
        .eq('id', id);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, message: 'Voucher deleted.' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

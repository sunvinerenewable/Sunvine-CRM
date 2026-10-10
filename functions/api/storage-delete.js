import { createClient } from '@supabase/supabase-js';
import { getClientIp, checkDistributedRateLimit } from '../_lib/rateLimiter.js';
import { requireUser } from '../_lib/requireAuth.js';
import { getCorsHeaders, handleOptionsResponse } from '../_lib/cors.js';
import { getR2Client } from '../_lib/r2.js';

function extractAllDocPaths(documents) {
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

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return handleOptionsResponse(request, env);
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed. Use POST.' }, { status: 405, headers: corsHeaders });
  }

  const { payload: user, errorResponse } = await requireUser(request, env);
  if (errorResponse) {
    for (const [k, v] of corsHeaders.entries()) errorResponse.headers.set(k, v);
    return errorResponse;
  }

  const clientIp = getClientIp(request);
  const rateLimit = await checkDistributedRateLimit(env, `storage_del_${clientIp}`, { maxAttempts: 120, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Rate limit exceeded. Please wait a moment.' }, { status: 429, headers: corsHeaders });
  }

  try {
    let body = {};
    try {
      body = await request.json();
    } catch (_) {}

    const { paths = [], path } = body;
    const rawPaths = Array.isArray(paths) && paths.length > 0 ? paths : (path ? [path] : []);
    if (rawPaths.length === 0) {
      return Response.json({ error: 'No file path(s) provided for deletion.' }, { status: 400, headers: corsHeaders });
    }

    const cleanPaths = rawPaths.map(p => {
      if (typeof p !== 'string') return '';
      return p.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\/+/, '');
    }).filter(Boolean);

    if (cleanPaths.length === 0) {
      return Response.json({ error: 'Invalid path(s) provided.' }, { status: 400, headers: corsHeaders });
    }

    const role = user.role;
    const ownerId = String(user.dealer_id || user.id || '');

    if (role !== 'admin' && role !== 'staff') {
      const SUPABASE_URL = env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

      let dealerDocs = new Set();
      let queried = false;

      for (const p of cleanPaths) {
        if (p.startsWith(`${role}/${ownerId}/`) || p.startsWith(`dealer/${ownerId}/`)) {
          continue;
        }

        if (p.startsWith('applications/')) {
          const fileIdCandidate = p.split('/')[1];
          if (fileIdCandidate && SUPABASE_URL && SUPABASE_KEY) {
            try {
              const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
              const { data: appRow } = await db.from('customer_files').select('dealer_id').eq('id', fileIdCandidate).maybeSingle();
              if (appRow && String(appRow.dealer_id) === ownerId) {
                continue;
              }
            } catch (dbErr) {
              console.warn('[Storage Delete] Application ownership check error:', dbErr.message);
            }
          }
        }

        if (!queried) {
          if (SUPABASE_URL && SUPABASE_KEY) {
            try {
              const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
              const { data: files } = await db.from('customer_files').select('documents').eq('dealer_id', ownerId);
              if (Array.isArray(files)) {
                for (const f of files) {
                  extractAllDocPaths(f.documents).forEach(doc => dealerDocs.add(doc));
                }
              }
            } catch (dbErr) {
              console.warn('[Storage Delete] Ownership check query error:', dbErr.message);
            }
          }
          queried = true;
        }

        if (!dealerDocs.has(p)) {
          return Response.json({ error: `Forbidden: You do not own document "${p}".` }, { status: 403, headers: corsHeaders });
        }
      }
    }

    const R2_BUCKET = env?.R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || 'sunvine-documents';
    const SUPABASE_URL = env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    const r2Client = getR2Client(env);
    const results = { r2: false, supabase: false, deletedCount: cleanPaths.length };

    // 1. Delete from Cloudflare R2
    if (r2Client) {
      try {
        await Promise.allSettled(
          cleanPaths.map(key => r2Client.deleteObject(key))
        );
        results.r2 = true;
      } catch (r2Err) {
        console.warn('[Storage Delete] R2 deletion warning:', r2Err?.message);
      }
    }

    // 2. Delete from Supabase Storage
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
        await supabase.storage.from(R2_BUCKET).remove(cleanPaths);
        results.supabase = true;
      } catch (sbErr) {
        console.warn('[Storage Delete] Supabase deletion warning:', sbErr?.message);
      }
    }

    return Response.json({
      success: true,
      message: `Deleted ${cleanPaths.length} file(s) from storage`,
      paths: cleanPaths,
      results
    }, { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('[Storage Delete] Error deleting files:', err);
    return Response.json({ error: 'Failed to delete file from storage' }, { status: 500, headers: corsHeaders });
  }
}

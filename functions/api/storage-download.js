import { createClient } from '@supabase/supabase-js';
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

  if (request.method !== 'GET') {
    return Response.json({ error: 'Method Not Allowed. Use GET.' }, { status: 405, headers: corsHeaders });
  }

  const { payload: user, errorResponse } = await requireUser(request, env);
  if (errorResponse) {
    for (const [k, v] of corsHeaders.entries()) errorResponse.headers.set(k, v);
    return errorResponse;
  }

  try {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url') || '';
    let targetPath = url.searchParams.get('path') || '';
    const filename = url.searchParams.get('filename') || '';

    if (!targetPath && targetUrl) {
      try {
        const parsed = new URL(targetUrl);
        targetPath = parsed.pathname.replace(/^\/+/, '');
      } catch {
        targetPath = targetUrl.replace(/^https?:\/\/[^\/]+\//, '');
      }
    }

    const cleanPath = targetPath.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\/+/, '');
    if (!cleanPath && !targetUrl) {
      return Response.json({ error: 'Document URL or path is required for download.' }, { status: 400, headers: corsHeaders });
    }

    const role = user.role;
    const ownerId = String(user.dealer_id || user.id || '');

    if (role !== 'admin' && role !== 'staff') {
      let isOwner = false;
      if (cleanPath.startsWith(`${role}/${ownerId}/`) || cleanPath.startsWith(`dealer/${ownerId}/`)) {
        isOwner = true;
      } else {
        const supabaseUrl = env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceKey = env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceKey) {
          try {
            const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
            if (cleanPath.startsWith('applications/')) {
              const fileIdCandidate = cleanPath.split('/')[1];
              if (fileIdCandidate) {
                const { data: appRow } = await db.from('customer_files').select('dealer_id').eq('id', fileIdCandidate).maybeSingle();
                if (appRow && String(appRow.dealer_id) === ownerId) {
                  isOwner = true;
                }
              }
            }

            if (!isOwner) {
              const { data: files } = await db.from('customer_files').select('documents').eq('dealer_id', ownerId);
              if (Array.isArray(files)) {
                for (const f of files) {
                  const docPaths = extractAllDocPaths(f.documents);
                  if (docPaths.includes(cleanPath)) {
                    isOwner = true;
                    break;
                  }
                }
              }
            }
          } catch (dbErr) {
            console.warn('[Storage Download] Ownership verification error:', dbErr.message);
          }
        }
      }

      if (!isOwner) {
        return Response.json({ error: 'Forbidden: You do not have access to this document.' }, { status: 403, headers: corsHeaders });
      }
    }

    const cleanFilename = (filename || cleanPath.split('/').pop() || 'document.pdf').replace(/["\r\n]/g, '_');
    const r2Client = getR2Client(env);

    // 1. Direct R2 fetch via aws4fetch
    if (r2Client && cleanPath) {
      try {
        const r2Res = await r2Client.getObject(cleanPath);
        if (r2Res.ok) {
          const headers = new Headers(corsHeaders);
          headers.set('Content-Disposition', `attachment; filename="${cleanFilename}"`);
          headers.set('Content-Type', r2Res.headers.get('content-type') || 'application/octet-stream');
          if (r2Res.headers.get('content-length')) {
            headers.set('Content-Length', r2Res.headers.get('content-length'));
          }
          headers.set('Cache-Control', 'private, no-transform, max-age=3600');
          return new Response(r2Res.body, { status: 200, headers });
        }
      } catch (r2Err) {
        console.warn('[Storage Download] R2 getObject failed, trying fetch fallback:', r2Err.message);
      }
    }

    // 2. Server-side fetch fallback
    if (targetUrl) {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        return Response.json({ error: `Failed to fetch file from storage (${response.statusText})` }, { status: response.status, headers: corsHeaders });
      }

      const headers = new Headers(corsHeaders);
      headers.set('Content-Disposition', `attachment; filename="${cleanFilename}"`);
      headers.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
      if (response.headers.get('content-length')) {
        headers.set('Content-Length', response.headers.get('content-length'));
      }
      headers.set('Cache-Control', 'private, no-transform, max-age=3600');
      return new Response(response.body, { status: 200, headers });
    }

    return Response.json({ error: 'Document could not be located.' }, { status: 404, headers: corsHeaders });
  } catch (err) {
    console.error('[Storage Download] Error:', err);
    return Response.json({ error: err.message || 'Failed to download document.' }, { status: 500, headers: corsHeaders });
  }
}

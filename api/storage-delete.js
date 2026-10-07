import { createClient } from '@supabase/supabase-js';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getClientIp, checkDistributedRateLimit } from './_lib/rateLimiter.js';
import { requireUser } from './_lib/requireAuth.js';
import { applyCors } from './_lib/cors.js';
import { ensureEnvLoaded } from './_lib/db.js';

ensureEnvLoaded();

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

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // SEC-009: Auth check (no dev bypass — fail closed)
  const user = requireUser(req, res);
  if (!user) return;

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const clientIp = getClientIp(req);
  const rateLimit = await checkDistributedRateLimit(`storage_del_${clientIp}`, { maxAttempts: 120, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  try {
    const { paths = [], path } = req.body || {};

    const rawPaths = Array.isArray(paths) && paths.length > 0 ? paths : (path ? [path] : []);
    if (rawPaths.length === 0) {
      return res.status(400).json({ error: 'No file path(s) provided for deletion.' });
    }

    const cleanPaths = rawPaths.map(p => {
      if (typeof p !== 'string') return '';
      return p.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\/+/, '');
    }).filter(Boolean);

    if (cleanPaths.length === 0) {
      return res.status(400).json({ error: 'Invalid path(s) provided.' });
    }

    // SEC-009: Verify ownership for non-admin/staff callers
    const role = user.role;
    const ownerId = String(user.dealer_id || user.id || '');

    if (role !== 'admin' && role !== 'staff') {
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

      let dealerDocs = new Set();
      let queried = false;

      for (const p of cleanPaths) {
        if (p.startsWith(`${role}/${ownerId}/`) || p.startsWith(`dealer/${ownerId}/`)) {
          continue;
        }

        // Legacy paths: verify against customer_files
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
          return res.status(403).json({ error: `Forbidden: You do not own document "${p}".` });
        }
      }
    }

    // Cloudflare R2 Environment Configuration
    const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
    // SEC-009: Strictly use server-configured bucket (ignore client param)
    const R2_BUCKET = process.env.R2_BUCKET_NAME || 'sunvine-documents';
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const hasR2Config = Boolean(
      CF_ACCOUNT_ID &&
      R2_ACCESS_KEY &&
      R2_SECRET_KEY &&
      !CF_ACCOUNT_ID.includes('your_') &&
      !R2_ACCESS_KEY.includes('your_')
    );

    const r2Client = hasR2Config
      ? new S3Client({
          region: 'auto',
          endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: R2_ACCESS_KEY,
            secretAccessKey: R2_SECRET_KEY,
          },
        })
      : null;

    const results = { r2: false, supabase: false, deletedCount: cleanPaths.length };

    // ── 1. Delete from Cloudflare R2 ──────────────────────────────────────────
    if (r2Client) {
      try {
        await Promise.allSettled(
          cleanPaths.map(key =>
            r2Client.send(new DeleteObjectCommand({
              Bucket: R2_BUCKET,
              Key: key
            }))
          )
        );
        results.r2 = true;
      } catch (r2Err) {
        console.warn('[Storage Delete] R2 deletion warning:', r2Err?.message);
      }
    }

    // ── 2. Delete from Supabase Storage ───────────────────────────────────────
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { persistSession: false }
        });
        await supabase.storage.from(R2_BUCKET).remove(cleanPaths);
        results.supabase = true;
      } catch (sbErr) {
        console.warn('[Storage Delete] Supabase deletion warning:', sbErr?.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Deleted ${cleanPaths.length} file(s) from storage`,
      paths: cleanPaths,
      results
    });
  } catch (err) {
    console.error('[Storage Delete] Error deleting files:', err);
    return res.status(500).json({ error: 'Failed to delete file from storage' });
  }
}

import { createClient } from '@supabase/supabase-js';
import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getClientIp, checkDistributedRateLimit } from './_lib/rateLimiter.js';
import { verifyJwt } from './_lib/jwt.js';
import { ensureEnvLoaded } from './_lib/db.js';

export default async function handler(req, res) {
  ensureEnvLoaded();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // Cloudflare R2 Environment Configuration
  const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
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

  // ── Auth check ────────────────────────────────────────────────────────────
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
    const [k, ...v] = c.split('=');
    if (k) acc[k.trim()] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
  const authHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const token = cookies.sunvine_auth_token || authHeader;
  const isDev = process.env.NODE_ENV !== 'production';
  const jwtResult = verifyJwt(token);
  if (!jwtResult.valid && !isDev) return res.status(401).json({ error: 'Authentication required.' });

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const clientIp = getClientIp(req);
  const rateLimit = await checkDistributedRateLimit(`storage_del_${clientIp}`, { maxAttempts: 120, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  try {
    const { paths = [], path, bucket = (R2_BUCKET || 'sunvine-documents') } = req.body || {};

    const rawPaths = Array.isArray(paths) && paths.length > 0 ? paths : (path ? [path] : []);
    if (rawPaths.length === 0) {
      return res.status(400).json({ error: 'No file path(s) provided for deletion.' });
    }

    const cleanPaths = rawPaths.map(p => {
      if (typeof p !== 'string') return '';
      // Strip domain and leading slashes
      return p.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\/+/, '');
    }).filter(Boolean);

    if (cleanPaths.length === 0) {
      return res.status(400).json({ error: 'Invalid path(s) provided.' });
    }

    const results = { r2: false, supabase: false, deletedCount: cleanPaths.length };

    // ── 1. Delete from Cloudflare R2 ──────────────────────────────────────────
    if (r2Client) {
      try {
        await Promise.allSettled(
          cleanPaths.map(key =>
            r2Client.send(new DeleteObjectCommand({
              Bucket: bucket,
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
        await supabase.storage.from(bucket).remove(cleanPaths);
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

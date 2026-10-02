import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { getClientIp, checkDistributedRateLimit } from './_lib/rateLimiter.js';
import { verifyJwt } from './_lib/jwt.js';
import { ensureEnvLoaded } from './_lib/db.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // Strict 2 MB (2048 KB) max limit

export default async function handler(req, res) {
  ensureEnvLoaded();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // Cloudflare R2 Environment Configuration (fresh on each request)
  const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_BUCKET = process.env.R2_BUCKET_NAME || 'sunvine-documents';
  const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN;
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
  const rateLimit = await checkDistributedRateLimit(`storage_${clientIp}`, { maxAttempts: 60, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Upload rate limit exceeded. Please wait a few moments.' });
  }

  try {
    const { fileName, customFileName, fileType, fileSize, bucket = (R2_BUCKET || 'sunvine-documents'), folder = 'uploads' } = req.body || {};

    if (!fileName) {
      return res.status(400).json({ error: 'File name is required.' });
    }

    const effectiveType = (fileType || 'application/pdf').toLowerCase();
    const fileExtFromName = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';

    if (fileType && !ALLOWED_MIME_TYPES.has(effectiveType)) {
      return res.status(400).json({
        error: 'Invalid file format. Only PDF (.pdf) and Image (.jpeg, .jpg, .png, .webp) files under 2 MB are permitted.'
      });
    }

    if (fileExtFromName && !ALLOWED_EXTENSIONS.has(fileExtFromName)) {
      return res.status(400).json({
        error: 'Invalid file extension. Only .pdf, .jpeg, .jpg, .png, and .webp files under 2 MB are permitted.'
      });
    }

    if (fileSize && Number(fileSize) > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({
        error: `File size exceeds the 2 MB limit required for government portal submission. Please compress the file.`
      });
    }

    // Derive extension
    const MIME_TO_EXT = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    const extension = fileExtFromName || MIME_TO_EXT[effectiveType] || 'pdf';
    const cleanFolder = (folder || 'uploads').replace(/[^a-zA-Z0-9_\-\/]/g, '').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    
    let finalFileName;
    if (customFileName) {
      const baseCustomName = customFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
      finalFileName = `${baseCustomName}.${extension}`;
    } else {
      const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
      finalFileName = `${baseName}.${extension}`;
    }

    const filePath = `${cleanFolder}/${finalFileName}`;

    // ── Pre-Upload Cleanup: Automatically purge existing sibling files / old extensions ──
    // When replacing a file (e.g. replacing Aadhaar_Card.png with Aadhaar_Card.pdf),
    // we must delete all previous extension variants so old files don't linger in Cloudflare R2 / Supabase.
    const baseCleanName = customFileName
      ? customFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
      : fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');

    const keysToPurge = new Set();
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    for (const altExt of allowedExts) {
      const candidate = `${cleanFolder}/${baseCleanName}.${altExt}`;
      if (candidate !== filePath) {
        keysToPurge.add(candidate);
      }
    }

    const { oldPath, oldUrl } = req.body || {};
    const rawOld = oldPath || oldUrl;
    if (rawOld && typeof rawOld === 'string') {
      const cleanOldKey = rawOld.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\/+/, '');
      if (cleanOldKey && cleanOldKey !== filePath) {
        keysToPurge.add(cleanOldKey);
      }
    }

    if (keysToPurge.size > 0) {
      if (r2Client) {
        await Promise.allSettled(
          Array.from(keysToPurge).map(key =>
            r2Client.send(new DeleteObjectCommand({
              Bucket: bucket,
              Key: key
            })).catch(() => null)
          )
        );
      }

      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
          await supabaseAdmin.storage.from(bucket).remove(Array.from(keysToPurge)).catch(() => null);
        } catch {
          // non-blocking cleanup
        }
      }
    }

    // ── 1. Cloudflare R2 Upload Path (Primary) ────────────────────────────────
    if (r2Client) {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: filePath,
        ContentType: fileType,
      });

      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });
      const publicBase = R2_PUBLIC_DOMAIN ? R2_PUBLIC_DOMAIN.replace(/\/+$/, '') : `https://${bucket}.${CF_ACCOUNT_ID}.r2.dev`;
      const publicUrl = `${publicBase}/${filePath}`;

      return res.status(200).json({
        success: true,
        provider: 'cloudflare-r2',
        signedUrl,
        path: filePath,
        bucket,
        publicUrl,
        expiresIn: 900 // 15 mins
      });
    }

    // ── 2. Supabase Storage Fallback (If R2 is not configured) ─────────────────
    if (SUPABASE_URL && SUPABASE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
      });

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(filePath);

      if (error) {
        console.warn('[Storage Presign] Supabase fallback direct notice:', error.message);
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;
        return res.status(200).json({
          success: true,
          provider: 'supabase',
          method: 'POST',
          path: filePath,
          bucket,
          publicUrl,
          fallbackDirect: true
        });
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;
      return res.status(200).json({
        success: true,
        provider: 'supabase',
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path || filePath,
        bucket,
        publicUrl,
        expiresIn: 900
      });
    }

    return res.status(500).json({ error: 'No storage provider configured (R2 or Supabase).' });
  } catch (err) {
    console.error('[Storage Presign] Error generating upload URL:', err);
    return res.status(500).json({ error: 'Failed to generate secure presigned upload URL' });
  }
}


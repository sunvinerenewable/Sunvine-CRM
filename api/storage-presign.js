import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getClientIp, checkDistributedRateLimit } from './_lib/rateLimiter.js';
import { requireUser } from './_lib/requireAuth.js';
import { applyCors } from './_lib/cors.js';
import { ensureEnvLoaded } from './_lib/db.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);

const MIME_TO_EXT = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // Strict 2 MB (2048 KB) max limit

export default async function handler(req, res) {
  ensureEnvLoaded();
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // SEC-009: Auth check (no dev bypass — fail closed)
  const user = await requireUser(req, res);
  if (!user) return;

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const clientIp = getClientIp(req);
  const rateLimit = await checkDistributedRateLimit(`storage_${clientIp}`, { maxAttempts: 60, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Upload rate limit exceeded. Please wait a few moments.' });
  }

  try {
    const { fileName, customFileName, fileType, fileSize, folder = 'uploads', fileId, applicationId, docType, docKey, fileIndex } = req.body || {};

    if (!fileName) {
      return res.status(400).json({ error: 'File name is required.' });
    }

    const effectiveType = (fileType || 'application/pdf').toLowerCase();
    const fileExtFromName = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';

    // SEC-029: Validate file format & MIME type
    if (!ALLOWED_MIME_TYPES.has(effectiveType)) {
      return res.status(400).json({
        error: 'Invalid file format. Only PDF (.pdf) and Image (.jpeg, .jpg, .png, .webp) files are permitted.'
      });
    }

    if (fileExtFromName && !ALLOWED_EXTENSIONS.has(fileExtFromName)) {
      return res.status(400).json({
        error: 'Invalid file extension. Only .pdf, .jpeg, .jpg, .png, and .webp files are permitted.'
      });
    }

    // SEC-029: Enforce upload max size limit (2 MB)
    if (fileSize !== undefined && fileSize !== null) {
      const numSize = Number(fileSize);
      if (isNaN(numSize) || numSize <= 0) {
        return res.status(400).json({ error: 'Invalid file size parameter.' });
      }
      if (numSize > MAX_FILE_SIZE_BYTES) {
        return res.status(400).json({
          error: 'File size exceeds the 2 MB limit required for government portal submission. Please compress the file.'
        });
      }
    }

    // Derive extension
    const extension = fileExtFromName || MIME_TO_EXT[effectiveType] || 'pdf';
    const role = user.role || 'dealer';
    const ownerId = String(user.dealer_id || user.id || 'unknown');

    // ── Canonical Application Storage Support ─────────────────────────────────
    // applications/{fileId}/{documentType}/{filename}
    const targetFileId = fileId || applicationId || (folder && folder.startsWith('applications/') ? folder.split('/')[1] : null);
    const targetDocType = docType || docKey || (folder && folder.startsWith('applications/') ? folder.split('/')[2] : null);

    let filePath;
    let cleanFolder;
    let finalFileName;
    let isCanonicalApplication = false;

    if (targetFileId) {
      const cleanFileId = String(targetFileId).trim().replace(/[^a-zA-Z0-9_-]/g, '_');

      // Dealer isolation check: if caller is a dealer, verify file ownership if file already exists in DB
      if (role !== 'admin' && role !== 'staff') {
        const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (SUPABASE_URL && SUPABASE_KEY) {
          try {
            const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
            const { data: existingFile } = await db.from('customer_files').select('dealer_id').eq('id', cleanFileId).maybeSingle();
            if (existingFile && existingFile.dealer_id && String(existingFile.dealer_id) !== ownerId) {
              return res.status(403).json({ error: 'Forbidden: You do not own this customer application.' });
            }
          } catch (dbErr) {
            console.warn('[Storage Presign] Ownership check error:', dbErr.message);
          }
        }
      }

      isCanonicalApplication = true;
      const { getDocumentTypeSlug } = await import('./_lib/documentStorage.js');
      const docSlug = getDocumentTypeSlug(targetDocType || 'document');
      cleanFolder = `applications/${cleanFileId}/${docSlug}`;

      if (customFileName) {
        const baseCustomName = customFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
        finalFileName = `${baseCustomName}.${extension}`;
      } else if (fileIndex !== undefined && fileIndex !== null && fileIndex !== '') {
        finalFileName = `${docSlug}-${fileIndex}.${extension}`;
      } else {
        finalFileName = `${docSlug}.${extension}`;
      }

      filePath = `${cleanFolder}/${finalFileName}`;
    } else {
      // Legacy / General uploads: scoped by role & owner ID
      cleanFolder = (folder || 'uploads').replace(/[^a-zA-Z0-9_\-\/]/g, '').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
      if (customFileName) {
        const baseCustomName = customFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
        finalFileName = `${baseCustomName}.${extension}`;
      } else {
        const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
        finalFileName = `${baseName}.${extension}`;
      }

      const ownerPrefix = `${role}/${ownerId}`;
      filePath = `${ownerPrefix}/${cleanFolder}/${finalFileName}`;
    }

    // Cloudflare R2 Environment Configuration
    const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
    // SEC-009: Strictly use server-configured bucket (ignore client param)
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

    // ── Pre-Upload Cleanup: Automatically purge existing sibling files for THIS owner/application only ──
    const baseCleanName = finalFileName.replace(/\.[^/.]+$/, '');

    const keysToPurge = new Set();
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    for (const altExt of allowedExts) {
      const candidate = isCanonicalApplication
        ? `${cleanFolder}/${baseCleanName}.${altExt}`
        : `${ownerPrefix}/${cleanFolder}/${baseCleanName}.${altExt}`;
      if (candidate !== filePath) {
        keysToPurge.add(candidate);
      }
    }

    const { oldPath, oldUrl } = req.body || {};
    const rawOld = oldPath || oldUrl;
    if (rawOld && typeof rawOld === 'string') {
      const cleanOldKey = rawOld.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\/+/, '');
      // Only purge old key if it belongs to this canonical folder or owner
      const isAllowedOldKey = isCanonicalApplication
        ? cleanOldKey.startsWith(`${cleanFolder}/`)
        : cleanOldKey.startsWith(`${ownerPrefix}/`);
      if (cleanOldKey && cleanOldKey !== filePath && isAllowedOldKey) {
        keysToPurge.add(cleanOldKey);
      }
    }

    if (keysToPurge.size > 0) {
      if (r2Client) {
        await Promise.allSettled(
          Array.from(keysToPurge).map(key =>
            r2Client.send(new DeleteObjectCommand({
              Bucket: R2_BUCKET,
              Key: key
            })).catch(() => null)
          )
        );
      }

      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
          await supabaseAdmin.storage.from(R2_BUCKET).remove(Array.from(keysToPurge)).catch(() => null);
        } catch {
          // non-blocking cleanup
        }
      }
    }

    // ── 1. Cloudflare R2 Upload Path (Primary) ────────────────────────────────
    if (r2Client) {
      const putParams = {
        Bucket: R2_BUCKET,
        Key: filePath,
        ContentType: effectiveType,
      };
      if (fileSize !== undefined && fileSize !== null) {
        const numSize = Number(fileSize);
        if (!isNaN(numSize) && numSize > 0) {
          putParams.ContentLength = numSize;
        }
      }

      const command = new PutObjectCommand(putParams);

      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });
      const publicBase = R2_PUBLIC_DOMAIN ? R2_PUBLIC_DOMAIN.replace(/\/+$/, '') : `https://${R2_BUCKET}.${CF_ACCOUNT_ID}.r2.dev`;
      const publicUrl = `${publicBase}/${filePath}`;

      return res.status(200).json({
        success: true,
        provider: 'cloudflare-r2',
        signedUrl,
        path: filePath,
        bucket: R2_BUCKET,
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
        .from(R2_BUCKET)
        .createSignedUploadUrl(filePath);

      if (error) {
        console.warn('[Storage Presign] Supabase fallback direct notice:', error.message);
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${R2_BUCKET}/${filePath}`;
        return res.status(200).json({
          success: true,
          provider: 'supabase',
          method: 'POST',
          path: filePath,
          bucket: R2_BUCKET,
          publicUrl,
          fallbackDirect: true
        });
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${R2_BUCKET}/${filePath}`;
      return res.status(200).json({
        success: true,
        provider: 'supabase',
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path || filePath,
        bucket: R2_BUCKET,
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

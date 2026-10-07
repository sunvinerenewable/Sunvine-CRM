import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
  }

  // SEC-009: Auth check (no dev bypass — fail closed)
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const { url, path: objectPath, filename } = req.query || {};

    const targetUrl = url || '';
    let targetPath = objectPath || '';

    // If path not directly passed, extract from URL
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
      return res.status(400).json({ error: 'Document URL or path is required for download.' });
    }

    // SEC-009: Verify ownership for non-admin/staff callers
    const role = user.role;
    const ownerId = String(user.dealer_id || user.id || '');

    if (role !== 'admin' && role !== 'staff') {
      let isOwner = false;

      if (cleanPath.startsWith(`${role}/${ownerId}/`) || cleanPath.startsWith(`dealer/${ownerId}/`)) {
        isOwner = true;
      } else {
        // Legacy keys (e.g. uploads/<name>): verify dealer ownership via customer_files
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceKey) {
          try {
            const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
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
          } catch (dbErr) {
            console.warn('[Storage Download] Ownership verification error:', dbErr.message);
          }
        }
      }

      if (!isOwner) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this document.' });
      }
    }

    const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
    // SEC-009: Strictly use server-configured bucket
    const R2_BUCKET = process.env.R2_BUCKET_NAME || 'sunvine-documents';

    const hasR2Config = Boolean(
      CF_ACCOUNT_ID &&
      R2_ACCESS_KEY &&
      R2_SECRET_KEY &&
      !CF_ACCOUNT_ID.includes('your_') &&
      !R2_ACCESS_KEY.includes('your_')
    );

    let cleanFilename = (filename || cleanPath.split('/').pop() || 'document.pdf').replace(/["\r\n]/g, '_');

    // 1. Direct R2 S3 Client fetch (Streaming)
    if (hasR2Config && cleanPath) {
      try {
        const s3 = new S3Client({
          region: 'auto',
          endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: R2_ACCESS_KEY,
            secretAccessKey: R2_SECRET_KEY,
          },
        });

        const command = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: cleanPath,
        });

        const s3Res = await s3.send(command);

        res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
        res.setHeader('Content-Type', s3Res.ContentType || 'application/octet-stream');
        if (s3Res.ContentLength) {
          res.setHeader('Content-Length', s3Res.ContentLength);
        }
        res.setHeader('Cache-Control', 'private, no-transform, max-age=3600');

        const stream = s3Res.Body;
        if (stream.pipe) {
          return stream.pipe(res);
        } else {
          const byteArray = await stream.transformToByteArray();
          return res.end(Buffer.from(byteArray));
        }
      } catch (s3Err) {
        console.warn('[Storage Download] S3 GetObject failed, trying fetch fallback:', s3Err.message);
      }
    }

    // 2. Server-side fetch fallback
    if (targetUrl) {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch file from storage (${response.statusText})` });
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'private, no-transform, max-age=3600');
      return res.end(buffer);
    }

    return res.status(404).json({ error: 'Document could not be located.' });
  } catch (err) {
    console.error('[Storage Download] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to download document.' });
  }
}

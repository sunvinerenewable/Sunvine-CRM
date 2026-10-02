import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { verifyJwt } from './_lib/jwt.js';
import { ensureEnvLoaded } from './_lib/db.js';

export default async function handler(req, res) {
  ensureEnvLoaded();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
  }

  // Auth check
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
    const [k, ...v] = c.split('=');
    if (k) acc[k.trim()] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
  const authHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const token = cookies.sunvine_auth_token || authHeader;
  const isDev = process.env.NODE_ENV !== 'production';
  const jwtResult = verifyJwt(token);
  if (!jwtResult.valid && !isDev) {
    return res.status(401).json({ error: 'Authentication required to download documents.' });
  }

  try {
    const { url, path: objectPath, filename, bucket } = req.query || {};

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

    if (!targetPath && !targetUrl) {
      return res.status(400).json({ error: 'Document URL or path is required for download.' });
    }

    const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
    const R2_BUCKET = bucket || process.env.R2_BUCKET_NAME || 'sunvine-documents';

    const hasR2Config = Boolean(
      CF_ACCOUNT_ID &&
      R2_ACCESS_KEY &&
      R2_SECRET_KEY &&
      !CF_ACCOUNT_ID.includes('your_') &&
      !R2_ACCESS_KEY.includes('your_')
    );

    let cleanFilename = (filename || targetPath.split('/').pop() || 'document.pdf').replace(/["\r\n]/g, '_');

    // 1. Direct R2 S3 Client fetch (Streaming)
    if (hasR2Config && targetPath) {
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
          Key: targetPath,
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

    // 2. Server-side fetch fallback (No CORS on server)
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

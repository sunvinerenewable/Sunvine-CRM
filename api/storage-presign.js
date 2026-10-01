import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { getClientIp, checkRateLimit } from './_lib/rateLimiter.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wyberzvcyrjipjqpotwe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XzbS-fQMtSGf2LjFO40yzw_LtT98nG6';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB max

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // Rate limiting against automated storage flood attacks
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`storage_${clientIp}`, { maxAttempts: 20, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Upload rate limit exceeded. Please wait a few moments.' });
  }

  try {
    const { fileName, fileType, fileSize, bucket = 'sunvine-documents', folder = 'uploads' } = req.body || {};

    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'File name and file type are required.' });
    }

    if (!ALLOWED_MIME_TYPES.has(fileType.toLowerCase())) {
      return res.status(400).json({
        error: `File type ${fileType} is not permitted. Allowed formats: PDF, JPG, PNG, WEBP.`
      });
    }

    if (fileSize && Number(fileSize) > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({
        error: `File size exceeds the 15MB limit. Please compress the file before uploading.`
      });
    }

    // Sanitize extension
    const extension = fileName.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanFolder = folder.replace(/[^a-zA-Z0-9_\-\/]/g, '').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    const uniqueEntropy = crypto.randomBytes(6).toString('hex');
    const timestamp = Date.now();
    const filePath = `${cleanFolder}/${timestamp}_${uniqueEntropy}.${extension}`;

    // Initialize Supabase Client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });

    // Create Presigned Upload URL (Valid for 15 minutes)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.warn('[Storage Presign] Supabase notice:', error.message);
      // Fallback: If signed upload URLs are restricted by bucket configuration, return direct path
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;
      return res.status(200).json({
        success: true,
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
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path || filePath,
      bucket,
      publicUrl,
      expiresIn: 900 // 15 mins
    });
  } catch (err) {
    console.error('[Storage Presign] Error generating upload URL:', err);
    return res.status(500).json({ error: 'Failed to generate secure presigned upload URL' });
  }
}

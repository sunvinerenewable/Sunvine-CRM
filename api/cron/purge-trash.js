import { createClient } from '@supabase/supabase-js';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { extractAllDocPaths } from '../customer-files.js';

function getDb() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase database configuration missing.');
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

async function deleteR2Files(keys, bucket = process.env.R2_BUCKET_NAME || 'sunvine-documents') {
  if (!keys || keys.length === 0) return;
  const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
  if (!CF_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY || CF_ACCOUNT_ID.includes('your_')) return;

  try {
    const r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY }
    });

    await Promise.allSettled(
      keys.map(key => r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })))
    );
  } catch (err) {
    console.warn('[cron/purge-trash] R2 document purge notice:', err?.message);
  }
}

export default async function handler(req, res, injectedDb = null) {
  // Authorization check: Bearer token or CRON_SECRET header
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.headers['x-cron-secret'] !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized cron invocation.' });
  }

  let db;
  try {
    db = injectedDb || req.db || getDb();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  let purgedTrashCount = 0;
  let purgedCancelledDocCount = 0;

  try {
    // 1. Purge soft-deleted Trash files older than 14 days (Delete R2 objects + Delete DB row)
    const { data: expiredTrash, error: trashErr } = await db
      .from('customer_files')
      .select('id, documents')
      .eq('is_deleted', true)
      .lt('deleted_at', fourteenDaysAgo);

    if (trashErr) {
      console.error('[cron/purge-trash] Trash query error:', trashErr);
    } else if (Array.isArray(expiredTrash) && expiredTrash.length > 0) {
      for (const item of expiredTrash) {
        const docKeys = extractAllDocPaths(item.documents);
        if (docKeys.length > 0) {
          await deleteR2Files(docKeys);
        }
        await db.from('customer_files').delete().eq('id', item.id);
        purgedTrashCount++;
      }
    }

    // 2. Purge documents from Cancelled files older than 14 days (Clear R2 objects + Empty documents JSON)
    const { data: expiredCancelled, error: cancelErr } = await db
      .from('customer_files')
      .select('id, documents, timeline')
      .eq('status', 'Cancelled')
      .lt('cancelled_at', fourteenDaysAgo);

    if (cancelErr) {
      console.error('[cron/purge-trash] Cancelled query error:', cancelErr);
    } else if (Array.isArray(expiredCancelled) && expiredCancelled.length > 0) {
      for (const item of expiredCancelled) {
        const docKeys = extractAllDocPaths(item.documents);
        if (docKeys.length > 0) {
          await deleteR2Files(docKeys);
          const purgeNote = {
            title: 'Uploaded Documents Removed',
            description: 'Uploaded customer documents were permanently deleted after the 14-day recovery period ended.',
            timestamp: new Date().toISOString(),
            stage: 'CANCELLED',
            author: 'System Cron'
          };
          const updatedTimeline = Array.isArray(item.timeline) ? [...item.timeline, purgeNote] : [purgeNote];
          await db.from('customer_files').update({
            documents: {},
            timeline: updatedTimeline,
            updated_at: new Date().toISOString()
          }).eq('id', item.id);
          purgedCancelledDocCount++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      purgedTrashCount,
      purgedCancelledDocCount
    });
  } catch (err) {
    console.error('[cron/purge-trash] Execution exception:', err);
    return res.status(500).json({ error: 'Failed to execute purge maintenance.' });
  }
}

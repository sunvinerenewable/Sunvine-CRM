import { createClient } from '@supabase/supabase-js';

/**
 * functions/_lib/db.js
 *
 * Workers-compatible Database client using @supabase/supabase-js.
 * Uses service role key for administrative & server operations.
 */

export function getSupabaseServiceClient(env) {
  const url = env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL || process.env?.VITE_SUPABASE_URL;
  const serviceKey = env?.SUPABASE_SERVICE_ROLE_KEY || process.env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('[FATAL] SUPABASE_URL env var is required for the service client.');
  if (!serviceKey) throw new Error('[FATAL] SUPABASE_SERVICE_ROLE_KEY env var is required. Never fall back to the anon key for server-side operations.');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function getSupabaseClient(env) {
  return getSupabaseServiceClient(env);
}

import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env.js';

// The anon (publishable) key is public for public read-only catalogue queries.
// Security comes from RLS policies + server API gateway.
// All write mutations (insert, update, delete, upsert) must go through secure /api endpoints.
const supabaseUrl = ENV.SUPABASE_URL;
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY;

if ((!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') && !ENV.IS_TEST) {
  console.warn('[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. Supabase client will be non-functional.');
}

const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseAnonKey || 'placeholder-anon-key';

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

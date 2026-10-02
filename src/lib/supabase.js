import { createClient } from '@supabase/supabase-js';

// The anon (publishable) key is intentionally public — it is the standard
// Supabase design. Security comes from RLS policies + the API gateway.
// The real DB access for sensitive operations uses the server-only service
// key, never exposed here.
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL);
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE !== 'test') {
    console.warn('[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. Supabase client will be non-functional.');
  }
}

const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseAnonKey || 'placeholder-anon-key';

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false  // We use custom JWT, not Supabase Auth URL flow
  }
});

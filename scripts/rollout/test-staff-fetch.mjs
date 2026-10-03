import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = (m[2] || '').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const sb = createClient(supabaseUrl, supabaseAnonKey);

async function testFetch() {
  const { data, error } = await sb.from('staff_accounts').select('*').order('id', { ascending: true });
  console.log('SUPABASE ANON CLIENT RESULT:');
  console.log('Error:', error);
  console.log('Data count:', data?.length);
  console.log('Data rows:', data);
}

testFetch();

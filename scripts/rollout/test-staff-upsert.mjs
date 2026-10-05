import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

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

async function testInsert() {
  const cleanPhone = '9876543210';
  const staffId = 'STF-003';
  const passwordHash = bcrypt.hashSync('Sunvine@2026', 10);
  const payload = {
    id: staffId,
    name: 'Test Salesman',
    role: 'Field Sales Executive',
    phone: cleanPhone,
    mobile_number: cleanPhone,
    email: 'testsales@sunvine.in',
    password_hash: passwordHash,
    zone: 'Gujarat',
    city: 'Ahmedabad',
    department: 'sales',
    status: 'active',
    dealers_count: 0,
    direct_files_count: 0,
    dealer_files_count: 0,
    pipeline_kw: 0,
    rating: 4.9,
    updated_at: new Date().toISOString()
  };
  
  console.log('Inserting payload via Supabase Anon Client...');
  const { data, error } = await sb.from('staff_accounts').upsert([payload], { onConflict: 'id' }).select();
  console.log('Result Error:', error);
  console.log('Result Data:', data);
}

testInsert();

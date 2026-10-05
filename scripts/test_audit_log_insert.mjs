import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let env = {};
try {
  const content = fs.readFileSync('.env', 'utf8');
  for (const line of content.split('\n')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
} catch (e) {}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

console.log('Testing Supabase audit_logs INSERT via ANON KEY...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuditInsert() {
  const testPayload = {
    action: 'TEST_INSERT_VERIFICATION',
    module: 'SYSTEM_DIAGNOSTICS',
    entity_type: 'SYSTEM_DIAGNOSTICS',
    record_id: 'TEST-001',
    entity_id: 'TEST-001',
    user_id: 'ADM-001',
    user_name: 'Test Admin',
    user_email: 'admin@sunvine.in',
    role: 'System Administrator',
    user_role: 'admin',
    details: { reason: 'Verifying 400 Bad Request resolution', status: 'OK' },
    old_value: null,
    new_value: { test: true },
    ip_address: '127.0.0.1',
    status: 'VERIFIED'
  };

  const { data, error } = await supabase.from('audit_logs').insert([testPayload]).select();

  if (error) {
    console.error('❌ Insert FAILED:', {
      message: error.message,
      code: error.code,
      hint: error.hint,
      details: error.details
    });
    process.exit(1);
  } else {
    console.log('🎉 SUCCESS! Audit log inserted cleanly into Supabase:');
    console.table(data);
  }

  // Also test reading
  const { data: readData, error: readError } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (readError) {
    console.error('❌ Read FAILED:', readError);
  } else {
    console.log('🎉 SUCCESS! Read audit logs:');
    console.table(readData.map(r => ({
      id: r.id,
      action: r.action,
      module: r.module,
      created_at: r.created_at,
      user_name: r.user_name
    })));
  }
}

testAuditInsert().catch(err => console.error(err));

#!/usr/bin/env node
/**
 * scripts/createAccount.mjs
 *
 * Creates or updates an admin/dealer/staff account with a properly hashed password.
 * Run this BEFORE removing backdoor credentials from production.
 *
 * Usage:
 *   node scripts/createAccount.mjs --role admin --identifier admin@sunvinerenewable.com --name "Super Admin"
 *   node scripts/createAccount.mjs --role dealer --mobile 9876543210 --code SV-DLR-0001 --firm "Solar Co"
 *   node scripts/createAccount.mjs --role staff --mobile 8000050580 --name "Sales Rep" --dept sales
 *
 * Reads password from DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY env vars.
 * Password is NEVER printed or logged.
 * Prompts for password securely via stdin.
 */

import { createInterface } from 'readline';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { parseArgs } from 'node:util';

// ── PBKDF2 hash (same algorithm as api/_lib/security.js) ──────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${hash}`;
}

// ── Secure password prompt ─────────────────────────────────────────────────
function promptPassword(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(prompt);
    process.stdin.setRawMode?.(true);
    let pass = '';
    process.stdin.on('data', (char) => {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.setRawMode?.(false);
        process.stdout.write('\n');
        rl.close();
        resolve(pass);
      } else if (char === '\u0003') {
        process.exit(1);
      } else {
        pass += char;
      }
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const { values: args } = parseArgs({
    options: {
      role: { type: 'string' },
      identifier: { type: 'string' },
      mobile: { type: 'string' },
      name: { type: 'string' },
      code: { type: 'string' },
      firm: { type: 'string' },
      dept: { type: 'string' },
      email: { type: 'string' }
    },
    allowPositionals: true
  });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required.');
    process.exit(1);
  }

  const role = (args.role || '').toLowerCase();
  if (!['admin', 'dealer', 'staff'].includes(role)) {
    console.error('ERROR: --role must be admin, dealer, or staff');
    process.exit(1);
  }

  const password = await promptPassword('Enter new password (min 8 chars, not echoed): ');
  if (!password || password.length < 8) {
    console.error('ERROR: Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = hashPassword(password);
  // DO NOT log the password or hash

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let result;
  if (role === 'admin') {
    const email = args.email || args.identifier;
    if (!email) { console.error('ERROR: --email required for admin.'); process.exit(1); }
    const { error } = await db.from('admin_users').upsert({
      email,
      full_name: args.name || 'Administrator',
      role: 'super_admin',
      password_hash: passwordHash
    }, { onConflict: 'email' });
    result = error;
  } else if (role === 'dealer') {
    const mobile = (args.mobile || '').replace(/\D/g, '').slice(-10);
    if (!mobile || mobile.length !== 10) { console.error('ERROR: --mobile (10 digits) required.'); process.exit(1); }
    if (!args.code || !args.firm) { console.error('ERROR: --code and --firm required for dealer.'); process.exit(1); }
    const { error } = await db.from('dealers').upsert({
      dealer_code: args.code,
      firm_name: args.firm,
      contact_person: args.name || args.firm,
      mobile_number: mobile,
      email: args.email || `${mobile}@sunvinedealer.in`,
      password_hash: passwordHash,
      status: 'active'
    }, { onConflict: 'mobile_number' });
    result = error;
  } else {
    const mobile = (args.mobile || '').replace(/\D/g, '').slice(-10);
    if (!mobile || mobile.length !== 10) { console.error('ERROR: --mobile (10 digits) required.'); process.exit(1); }
    const { error } = await db.from('staff_accounts').upsert({
      mobile_number: mobile,
      name: args.name || 'Staff Member',
      department: args.dept || 'sales',
      status: 'active',
      password_hash: passwordHash
    }, { onConflict: 'mobile_number' });
    result = error;
  }

  if (result) {
    console.error('ERROR creating account:', result.message);
    process.exit(1);
  }

  console.log(`✅ Account (${role}) created/updated successfully. Password stored as PBKDF2 hash.`);
  process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });

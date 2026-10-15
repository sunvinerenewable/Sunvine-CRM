import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getClient } from './db.mjs';

/**
 * Generates a cryptographically strong random password (16 characters)
 * containing uppercase, lowercase, numbers, and symbols.
 */
function generateStrongPassword(length = 16) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+';
  const all = upper + lower + digits + symbols;

  let pwd = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    symbols[crypto.randomInt(0, symbols.length)]
  ];

  for (let i = pwd.length; i < length; i++) {
    pwd.push(all[crypto.randomInt(0, all.length)]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }

  return pwd.join('');
}

async function forcePasswordReset() {
  const isExecute = process.argv.includes('--execute');

  console.log('===============================================================');
  console.log('🔐 ADMINISTRATIVE FORCE PASSWORD & ACCESS CODE ROTATION');
  console.log(`MODE: ${isExecute ? '⚡ LIVE EXECUTION (--execute flag detected)' : '🛡️ DRY-RUN MODE (Pass --execute to apply changes)'}`);
  console.log('===============================================================\n');

  const client = await getClient();

  try {
    // ── 1. Discover Accounts ───────────────────────────────────────────────────
    const adminRes = await client.query('SELECT id, email, username FROM public.admin_accounts ORDER BY id');
    const dealerRes = await client.query('SELECT id, dealer_code, mobile_number, email FROM public.dealer_accounts ORDER BY id');
    const staffRes = await client.query('SELECT id, name, mobile_number, phone, email FROM public.staff_accounts ORDER BY id');

    console.log(`Discovered Accounts:`);
    console.log(`  - Admin Accounts:  ${adminRes.rows.length}`);
    console.log(`  - Dealer Accounts: ${dealerRes.rows.length}`);
    console.log(`  - Staff Accounts:  ${staffRes.rows.length}`);
    console.log(`  - Total Accounts:  ${adminRes.rows.length + dealerRes.rows.length + staffRes.rows.length}\n`);

    if (adminRes.rows.length === 0 && dealerRes.rows.length === 0 && staffRes.rows.length === 0) {
      console.log('No accounts found in database to reset.');
      return;
    }

    // ── 2. Check if access_code column exists in staff_accounts ───────────────
    const staffColRes = await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'staff_accounts' 
        AND column_name = 'access_code'
    `);
    const hasStaffAccessCode = staffColRes.rows.length > 0;

    // ── 3. Generate New Credentials & Hashes ──────────────────────────────────
    const credentialsMap = [];
    const BCRYPT_SALT_ROUNDS = 10;

    console.log('Generating cryptographically random credentials...');

    // Process Admin Accounts
    const adminUpdates = [];
    for (const admin of adminRes.rows) {
      const newPassword = generateStrongPassword(16);
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
      const identifier = admin.email || admin.username || admin.id;

      credentialsMap.push({
        account_type: 'ADMIN',
        id: admin.id,
        identifier,
        email: admin.email || '',
        phone: '',
        generated_password: newPassword,
        reset_timestamp: new Date().toISOString()
      });

      adminUpdates.push({ id: admin.id, passwordHash });
    }

    // Process Dealer Accounts
    const dealerUpdates = [];
    for (const dealer of dealerRes.rows) {
      const newPassword = generateStrongPassword(16);
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
      const identifier = dealer.dealer_code || dealer.mobile_number || dealer.id;

      credentialsMap.push({
        account_type: 'DEALER',
        id: dealer.id,
        identifier,
        email: dealer.email || '',
        phone: dealer.mobile_number || '',
        generated_password: newPassword,
        reset_timestamp: new Date().toISOString()
      });

      dealerUpdates.push({ id: dealer.id, passwordHash });
    }

    // Process Staff Accounts
    const staffUpdates = [];
    for (const staff of staffRes.rows) {
      const newPassword = generateStrongPassword(16);
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
      const identifier = staff.name || staff.email || staff.id;
      const phone = staff.mobile_number || staff.phone || '';

      credentialsMap.push({
        account_type: 'STAFF',
        id: staff.id,
        identifier,
        email: staff.email || '',
        phone,
        generated_password: newPassword,
        reset_timestamp: new Date().toISOString()
      });

      staffUpdates.push({ id: staff.id, passwordHash, newPassword });
    }

    // ── 4. Apply Database Transaction (or Dry-Run Rollback) ─────────────────────
    await client.query('BEGIN');

    if (isExecute) {
      console.log('Executing atomic update on database accounts...');

      for (const item of adminUpdates) {
        await client.query(
          `UPDATE public.admin_accounts SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
          [item.passwordHash, item.id]
        );
      }

      for (const item of dealerUpdates) {
        await client.query(
          `UPDATE public.dealer_accounts SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
          [item.passwordHash, item.id]
        );
      }

      for (const item of staffUpdates) {
        if (hasStaffAccessCode) {
          await client.query(
            `UPDATE public.staff_accounts SET password_hash = $1, access_code = $2, updated_at = NOW() WHERE id = $3`,
            [item.passwordHash, item.newPassword, item.id]
          );
        } else {
          await client.query(
            `UPDATE public.staff_accounts SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
            [item.passwordHash, item.id]
          );
        }
      }

      await client.query('COMMIT');
      console.log('✅ Database transaction successfully COMMITTED.');
    } else {
      await client.query('ROLLBACK');
      console.log('🛡️ DRY RUN: Database changes rolled back. No rows were modified.');
    }

    // ── 5. Write Plaintext Credentials to Protected Local CSV ────────────────
    const localDir = path.resolve(process.cwd(), '.local');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const csvPath = path.join(localDir, 'reset-credentials.csv');
    const csvHeader = 'account_type,id,identifier,email,phone_or_mobile,generated_password,reset_timestamp\n';
    const csvRows = credentialsMap
      .map(r => `"${r.account_type}","${r.id}","${r.identifier.replace(/"/g, '""')}","${r.email}","${r.phone}","${r.generated_password}","${r.reset_timestamp}"`)
      .join('\n');

    fs.writeFileSync(csvPath, csvHeader + csvRows + '\n', { mode: 0o600, encoding: 'utf8' });

    console.log(`\n📁 Plaintext credentials successfully saved to:`);
    console.log(`   ${csvPath} (Permissions: 0600, Gitignored)`);
    console.log('🔒 Note: Plaintext passwords are NEVER printed to stdout / logs.');

    console.log('\n===============================================================');
    console.log(`SUMMARY: ${credentialsMap.length} accounts processed successfully.`);
    console.log('===============================================================');

  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('❌ Password reset failed:', err.message);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}

forcePasswordReset().catch(err => {
  console.error('Fatal execution error:', err.message);
  process.exit(1);
});

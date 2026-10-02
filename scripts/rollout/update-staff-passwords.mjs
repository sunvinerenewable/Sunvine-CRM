import { getClient } from './db.mjs';
import { hashPassword, hashBcrypt, verifyPassword } from '../../api/_lib/security.js';

async function updateStaffPasswords() {
  console.log('=== Updating Staff Passwords to staff123 ===\n');

  const newPlaintext = 'staff123';
  // Use standard bcrypt hash ($2a$10$...) matching PostgreSQL crypt()
  const newHash = hashBcrypt(newPlaintext, 10);

  const client = await getClient();
  try {
    console.log('Starting transaction...');
    await client.query('BEGIN');

    // Update staff_accounts
    const updateRes = await client.query(
      `UPDATE public.staff_accounts 
       SET password_hash = $1, access_code = $2, updated_at = NOW() 
       RETURNING id, name, role, phone, email`,
      [newHash, newPlaintext]
    );

    console.log(`Updated ${updateRes.rows.length} staff accounts:`);
    console.table(updateRes.rows);

    // Verify verification logic against the updated rows
    for (const row of updateRes.rows) {
      const ok = verifyPassword(newPlaintext, newHash);
      if (!ok) throw new Error(`Verification failed for ${row.name}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Transaction committed. All staff accounts now use password "staff123".');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to update staff passwords:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateStaffPasswords().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

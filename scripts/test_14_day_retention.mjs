import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

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

const client = new Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const mode = process.argv[2] || 'view';
const targetId = process.argv[3] || 'FIL-2026-085';

async function main() {
  await client.connect();
  console.log('🔗 Connected to PostgreSQL Database.\n');

  if (mode === 'set-expired') {
    // Set cancelled_at to 16 days in the past
    const pastDate = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString();
    await client.query(`
      UPDATE public.customer_files 
      SET status = 'Cancelled',
          stage = 'CANCELLED',
          cancelled_at = $1,
          cancellation_reason = COALESCE(cancellation_reason, 'Test Cancellation - 16 days ago')
      WHERE id = $2;
    `, [pastDate, targetId]);

    console.log(`✅ [TEST SIMULATION] Set file ${targetId} cancelled_at to 16 days ago (${pastDate}).`);
    console.log(`👉 Open your browser, go to Staff Files / Admin Files -> "Cancelled" tab.`);
    console.log(`👉 Notice that ${targetId} shows:`);
    console.log(`   - "Recovery period ended (Documents deleted)"`);
    console.log(`   - The Restore button is disabled and says "Recovery Locked" 🔒`);
  } else if (mode === 'set-active') {
    // Set cancelled_at to 2 days in the past (12 days remaining)
    const activeDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await client.query(`
      UPDATE public.customer_files 
      SET status = 'Cancelled',
          stage = 'CANCELLED',
          cancelled_at = $1,
          cancellation_reason = COALESCE(cancellation_reason, 'Customer Backed Out / Not Interested')
      WHERE id = $2;
    `, [activeDate, targetId]);

    console.log(`✅ [TEST SIMULATION] Set file ${targetId} cancelled_at to 2 days ago (${activeDate}).`);
    console.log(`👉 Open your browser, go to Staff Files / Admin Files -> "Cancelled" tab.`);
    console.log(`👉 Notice that ${targetId} shows:`);
    console.log(`   - "Restorable for 12 days (Until ...)"`);
    console.log(`   - The "Restore File" button is active and clickable! 🟢`);
  } else {
    // View current status
    const res = await client.query(`
      SELECT id, customer_name, status, stage, cancelled_at, cancellation_reason 
      FROM public.customer_files 
      ORDER BY created_at DESC 
      LIMIT 10;
    `);

    console.log('📋 Current Customer Files in Database:');
    const enriched = res.rows.map(row => {
      if (row.status !== 'Cancelled' || !row.cancelled_at) {
        return {
          ...row,
          recovery_status: 'Active Pipeline'
        };
      }
      const daysElapsed = (Date.now() - new Date(row.cancelled_at).getTime()) / (1000 * 60 * 60 * 24);
      const isExpired = daysElapsed >= 14;
      const daysRemaining = Math.max(0, Math.ceil(14 - daysElapsed));
      return {
        ...row,
        recovery_status: isExpired ? '❌ LOCKED (Expired)' : `🟢 Active (${daysRemaining} days left)`
      };
    });
    console.table(enriched);
  }

  await client.end();
}

main().catch(err => console.error(err));

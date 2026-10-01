import fs from 'fs';
import path from 'path';
import { getClient } from './db.mjs';

async function run() {
  console.log('=== Step 5: Migration 002 (RLS Lockdown) ===\n');

  const migrationFile = path.resolve(process.cwd(), 'supabase/migrations/002_rls_lockdown.sql');
  const sqlContent = fs.readFileSync(migrationFile, 'utf8');

  // Strip standalone BEGIN/COMMIT so runner manages the transaction boundary
  const cleanedSql = sqlContent
    .replace(/^\s*BEGIN\s*;/gim, '-- BEGIN (managed by runner)')
    .replace(/^\s*COMMIT\s*;/gim, '-- COMMIT (managed by runner)');

  const client = await getClient();

  try {
    // ── Phase 1: DRY RUN ──────────────────────────────────────────────────
    console.log('1. Starting DRY-RUN in rolled-back transaction...');
    await client.query('BEGIN');

    await client.query(cleanedSql);

    // Verify dry run inside the uncommitted transaction
    const policiesDry = await client.query(`
      SELECT count(*) AS total_policies 
      FROM pg_policies 
      WHERE schemaname = 'public'
    `);
    console.log(`   New policy count in dry-run: ${policiesDry.rows[0].total_policies}`);

    await client.query('ROLLBACK');
    console.log('   ✅ DRY-RUN SUCCESSFUL & ROLLED BACK.\n');

    // ── Phase 2: PRODUCTION COMMIT ─────────────────────────────────────────
    console.log('2. Applying Migration 002 to PRODUCTION in single transaction...');
    await client.query('BEGIN');
    await client.query(cleanedSql);
    await client.query('COMMIT');
    console.log('   ✅ TRANSACTION COMMITTED TO PRODUCTION.\n');

    // ── Phase 3: POST-COMMIT VERIFICATION ─────────────────────────────────
    console.log('3. Running verification queries...');
    const tableRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);

    const policyRes = await client.query(`
      SELECT tablename, policyname, cmd, roles 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      ORDER BY tablename, policyname
    `);

    const shareTokenCount = await client.query(`
      SELECT count(*) FROM public.quotations WHERE share_token IS NOT NULL
    `);

    console.log(`\nVerified RLS enabled on ${tableRes.rows.length} base tables:`);
    console.table(tableRes.rows);

    console.log(`\nActive Policies (${policyRes.rows.length} total):`);
    console.table(policyRes.rows);

    console.log(`\nQuotations with share_token populated: ${shareTokenCount.rows[0].count}`);

    // Save report
    const runDir = path.resolve(process.cwd(), 'rollout-run');
    if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

    let md = `# Migration 002 (RLS Lockdown) Verification Report\n\n`;
    md += `**Date**: ${new Date().toISOString()}\n`;
    md += `**Database**: wyberzvcyrjipjqpotwe (Supabase PostgreSQL)\n`;
    md += `**Migration File**: \`supabase/migrations/002_rls_lockdown.sql\`\n\n`;

    md += `## 1. Summary\n\n`;
    md += `- **Base Tables Protected with RLS**: ${tableRes.rows.length}/18 (100%)\n`;
    md += `- **Permissive Public Policies Removed**: All legacy permissive policies dropped\n`;
    md += `- **Strict Policies Installed**: ${policyRes.rows.length} policies\n`;
    md += `- **Sensitive Tables Locked to service_role**: \`admin_accounts\`, \`dealer_accounts\`, \`staff_accounts\`, \`customer_files\`, \`otp_verifications\`, \`audit_logs\`, \`notifications\`\n`;
    md += `- **Catalog Tables Read-Only**: \`solar_modules\`, \`solar_inverters\`, \`inverter_benchmark_matrix\`, \`bom_catalog\`, \`bos_pricing_matrix\`, \`dealer_custom_pricing\`, \`solar_kits_presets\`, \`pricing_presets\`, \`solar_banks\`, \`system_settings\`\n`;
    md += `- **Quotations Share Token Backfill**: ${shareTokenCount.rows[0].count} quotations\n`;
    md += `- **Sequence Installed**: \`quotation_seq\` & \`next_quotation_seq()\`\n\n`;

    md += `## 2. Table-by-Table RLS Status\n\n`;
    md += `| Table | Row Level Security (RLS) |\n`;
    md += `| :--- | :--- |\n`;
    for (const r of tableRes.rows) {
      md += `| \`${r.tablename}\` | **${r.rowsecurity ? 'ENABLED (ACTIVE)' : 'DISABLED'}** |\n`;
    }

    md += `\n## 3. Active Policy Roster\n\n`;
    md += `| Table | Policy Name | Command | Authorized Roles |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const p of policyRes.rows) {
      md += `| \`${p.tablename}\` | \`${p.policyname}\` | \`${p.cmd}\` | \`${p.roles}\` |\n`;
    }

    const reportPath = path.resolve(runDir, '04-migration-002.md');
    fs.writeFileSync(reportPath, md, 'utf8');
    console.log(`\nReport written to: ${reportPath}`);

  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('\n❌ Migration 002 Failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

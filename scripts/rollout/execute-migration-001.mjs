import fs from 'fs';
import path from 'path';
import { getClient } from './db.mjs';

async function run() {
  console.log('=== Step 2: Migration 001 (Numeric Catalog Prices) ===\n');

  const migrationFile = path.resolve(process.cwd(), 'supabase/migrations/001_numeric_prices.sql');
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

    // Verify dry run data inside the uncommitted transaction
    const modDry = await client.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(rate_per_wp_inr) AS populated,
        COUNT(*) FILTER (WHERE rate_per_wp_inr IS NULL) AS missing
      FROM public.solar_modules
    `);
    const invDry = await client.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(base_price_inr) AS populated,
        COUNT(*) FILTER (WHERE base_price_inr IS NULL) AS missing
      FROM public.solar_inverters
    `);

    console.log(`   solar_modules: ${modDry.rows[0].populated}/${modDry.rows[0].total} numeric populated (${modDry.rows[0].missing} null)`);
    console.log(`   solar_inverters: ${invDry.rows[0].populated}/${invDry.rows[0].total} numeric populated (${invDry.rows[0].missing} null)`);

    if (Number(modDry.rows[0].missing) > 0 || Number(invDry.rows[0].missing) > 0) {
      throw new Error(`Dry run found unparseable price rows: modules null=${modDry.rows[0].missing}, inverters null=${invDry.rows[0].missing}`);
    }

    await client.query('ROLLBACK');
    console.log('   ✅ DRY-RUN SUCCESSFUL & ROLLED BACK.\n');

    // ── Phase 2: PRODUCTION COMMIT ─────────────────────────────────────────
    console.log('2. Applying Migration 001 to PRODUCTION in single transaction...');
    await client.query('BEGIN');
    await client.query(cleanedSql);
    await client.query('COMMIT');
    console.log('   ✅ TRANSACTION COMMITTED TO PRODUCTION.\n');

    // ── Phase 3: POST-COMMIT VERIFICATION ─────────────────────────────────
    console.log('3. Running verification queries...');
    const modCount = await client.query('SELECT count(*) FROM public.solar_modules WHERE rate_per_wp_inr IS NOT NULL');
    const invCount = await client.query('SELECT count(*) FROM public.solar_inverters WHERE base_price_inr IS NOT NULL');

    const modSamples = await client.query(`
      SELECT id, brand, wattage, rate_per_wp, rate_per_wp_inr 
      FROM public.solar_modules 
      LIMIT 3
    `);
    const invSamples = await client.query(`
      SELECT id, brand, capacity_kw, base_price, base_price_inr 
      FROM public.solar_inverters 
      LIMIT 3
    `);

    console.log(`\nVerified Modules with Numeric Price: ${modCount.rows[0].count}`);
    console.table(modSamples.rows);
    console.log(`\nVerified Inverters with Numeric Price: ${invCount.rows[0].count}`);
    console.table(invSamples.rows);

    // Save report
    const runDir = path.resolve(process.cwd(), 'rollout-run');
    if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

    let md = `# Migration 001 Execution & Verification Report\n\n`;
    md += `**Date**: ${new Date().toISOString()}\n`;
    md += `**Database**: wyberzvcyrjipjqpotwe (Supabase PostgreSQL)\n`;
    md += `**Migration File**: \`supabase/migrations/001_numeric_prices.sql\`\n\n`;

    md += `## 1. Summary\n\n`;
    md += `- **solar_modules**: ${modCount.rows[0].count} rows with valid \`rate_per_wp_inr\` (0 unparseable rows)\n`;
    md += `- **solar_inverters**: ${invCount.rows[0].count} rows with valid \`base_price_inr\` (0 unparseable rows)\n`;
    md += `- **Dry-Run**: PASSED (rolled back successfully before commit)\n`;
    md += `- **Production Commit**: COMMITTED\n\n`;

    md += `## 2. Sample Rows: solar_modules\n\n`;
    md += `| ID | Brand | Wattage | Old String (\`rate_per_wp\`) | New Numeric (\`rate_per_wp_inr\`) |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const r of modSamples.rows) {
      md += `| \`${r.id}\` | ${r.brand} | ${r.wattage}W | \`${r.rate_per_wp}\` | **${r.rate_per_wp_inr}** |\n`;
    }

    md += `\n## 3. Sample Rows: solar_inverters\n\n`;
    md += `| ID | Brand | Capacity | Old String (\`base_price\`) | New Numeric (\`base_price_inr\`) |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const r of invSamples.rows) {
      md += `| \`${r.id}\` | ${r.brand} | ${r.capacity_kw} kW | \`${r.base_price}\` | **₹${Number(r.base_price_inr).toLocaleString('en-IN')}** |\n`;
    }

    const reportPath = path.resolve(runDir, '02-migration-001.md');
    fs.writeFileSync(reportPath, md, 'utf8');
    console.log(`\nReport written to: ${reportPath}`);

  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('\n❌ Migration 001 Failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

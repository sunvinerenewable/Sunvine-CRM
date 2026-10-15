/**
 * check-settings-keys.mjs — Settings Key Path Reconciliation Validator
 *
 * Scans `api/` and `src/` for all accesses to `systemSettings`, `settings`,
 * `governance_settings`, `statutory_taxes`, `company_profile`, `companyProfile`, `pricingPresets`, and `tierConfig`.
 * Validates them against `settings-contract.md` and `012_governance_defaults.sql`.
 */

import fs from 'fs';
import path from 'path';

const MIGRATION_PATH = path.resolve(process.cwd(), 'supabase/migrations/012_governance_defaults.sql');

// Schema definitions from 012_governance_defaults.sql and settings-contract.md
const GOVERNANCE_SETTINGS_KEYS = new Set([
  'max_discount_pct',
  'max_system_kw',
  'quote_prefix',
  'validity_days',
  'default_specific_yield',
  'default_tariff',
  'default_loan_rate',
  'upload_max_mb',
  'allow_custom_bom_lines',
  'max_custom_bom_value'
]);

const STATUTORY_TAXES_KEYS = new Set([
  'subsidy',
  'subsidy.slab1Rate',
  'subsidy.slab2Rate',
  'subsidy.cap',
  'subsidy.breakpointKw',
  'gstSlabs'
]);

const COMPANY_PROFILE_KEYS = new Set([
  'name',
  'gstin',
  'address',
  'state',
  'whatsapp',
  'helpdesk',
  'website',
  'email',
  'bank',
  'bank.bankName',
  'bank.accountNumber',
  'bank.ifsc',
  'bank.branch',
  'bank.accountHolder',
  'terms',
  'validityText'
]);

const PRICING_PRESETS_KEYS = new Set([
  'baseRatePerKw',
  'subsidyCap',
  'minMarginPerKw',
  'enforceMinMargin',
  'lastSynced',
  'updatedBy'
]);

const TIER_CONFIG_KEYS = new Set([
  'defaultMarginPerKw',
  'maxMarginCapPerKw',
  'minMarginPerKw'
]);

function getAllFiles(dir, exts = ['.js', '.jsx', '.ts', '.tsx', '.mjs']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(file))) {
      results.push(fullPath);
    }
  }
  return results;
}

function runAudit() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Settings Keys Contract & Codebase Access Audit            ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Verify 012 migration content
  if (!fs.existsSync(MIGRATION_PATH)) {
    console.error(`❌ Migration 012 missing at: ${MIGRATION_PATH}`);
    process.exit(1);
  }
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

  // 2. Scan code files in api/ and src/
  const scanDirs = [
    path.resolve(process.cwd(), 'api'),
    path.resolve(process.cwd(), 'src')
  ];

  let scannedFiles = [];
  for (const d of scanDirs) {
    scannedFiles = scannedFiles.concat(getAllFiles(d));
  }

  // Filter out test files and static reference data
  scannedFiles = scannedFiles.filter(f => !f.includes('__tests__') && !f.includes('gujaratDatabase.js'));

  console.log(`Scanning ${scannedFiles.length} source files across api/ and src/...\n`);

  const accessedGovernance = new Map();
  const accessedStatutory = new Map();
  const accessedCompany = new Map();
  const accessedPresets = new Map();
  const accessedTier = new Map();

  const brokenAccesses = [];

  // Patterns
  const govPattern = /(?:systemSettings\??\.|settings\??\.)?governance_settings\??\.([a-zA-Z0-9_]+)/g;
  const statPattern = /(?:systemSettings\??\.|settings\??\.)?statutory_taxes\??\.([a-zA-Z0-9_.]+)/g;
  const compPattern = /(?:systemSettings\??\.|settings\??\.)?(?:company_profile|companyProfile)\??\.([a-zA-Z0-9_.]+)/g;
  const presetPattern = /pricingPresets\??\.([a-zA-Z0-9_]+)/g;
  const tierPattern = /(?:tierConfig|tierMargins(?:\??\.(?:silver|gold|platinum|diamond))?)\??\.([a-zA-Z0-9_]+)/g;

  for (const file of scannedFiles) {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');

    // Governance
    let match;
    while ((match = govPattern.exec(content)) !== null) {
      const key = match[1];
      if (!accessedGovernance.has(key)) accessedGovernance.set(key, []);
      accessedGovernance.get(key).push(relPath);
      if (!GOVERNANCE_SETTINGS_KEYS.has(key)) {
        brokenAccesses.push({ type: 'governance_settings', key, file: relPath, raw: match[0] });
      }
    }

    // Statutory
    while ((match = statPattern.exec(content)) !== null) {
      const cleanChain = match[1].replace(/\?\./g, '.');
      const parts = cleanChain.split('.');
      const key = parts[0] === 'subsidy' && parts.length > 1
        ? `subsidy.${parts[1]}`
        : parts[0];
      if (!accessedStatutory.has(key)) accessedStatutory.set(key, []);
      accessedStatutory.get(key).push(relPath);
      if (!STATUTORY_TAXES_KEYS.has(key)) {
        brokenAccesses.push({ type: 'statutory_taxes', key, file: relPath, raw: match[0] });
      }
    }

    // Company
    while ((match = compPattern.exec(content)) !== null) {
      const cleanChain = match[1].replace(/\?\./g, '.');
      const parts = cleanChain.split('.');
      const key = parts[0] === 'bank' && parts.length > 1
        ? `bank.${parts[1]}`
        : parts[0];
      if (!accessedCompany.has(key)) accessedCompany.set(key, []);
      accessedCompany.get(key).push(relPath);
      if (!COMPANY_PROFILE_KEYS.has(key)) {
        brokenAccesses.push({ type: 'company_profile', key, file: relPath, raw: match[0] });
      }
    }

    // Presets
    while ((match = presetPattern.exec(content)) !== null) {
      const key = match[1];
      if (!accessedPresets.has(key)) accessedPresets.set(key, []);
      accessedPresets.get(key).push(relPath);
      if (!PRICING_PRESETS_KEYS.has(key)) {
        brokenAccesses.push({ type: 'pricingPresets', key, file: relPath, raw: match[0] });
      }
    }

    // Tier
    while ((match = tierPattern.exec(content)) !== null) {
      const key = match[1];
      if (['silver', 'gold', 'platinum', 'diamond'].includes(key)) continue;
      if (!accessedTier.has(key)) accessedTier.set(key, []);
      accessedTier.get(key).push(relPath);
      if (!TIER_CONFIG_KEYS.has(key)) {
        brokenAccesses.push({ type: 'tierConfig', key, file: relPath, raw: match[0] });
      }
    }
  }

  console.log('--- 1. Governance Settings Keys ---');
  for (const key of GOVERNANCE_SETTINGS_KEYS) {
    const occurrences = accessedGovernance.get(key);
    if (occurrences) {
      console.log(`  ✔ governance_settings.${key}: accessed in ${occurrences.length} place(s) (${occurrences[0]})`);
    } else {
      console.log(`  ⚠ governance_settings.${key}: NOT accessed in code (dead or admin-only setting)`);
    }
  }

  console.log('\n--- 2. Statutory Taxes & Subsidy Keys ---');
  for (const key of STATUTORY_TAXES_KEYS) {
    const occurrences = accessedStatutory.get(key);
    if (occurrences) {
      console.log(`  ✔ statutory_taxes.${key}: accessed in ${occurrences.length} place(s) (${occurrences[0]})`);
    } else {
      console.log(`  ⚠ statutory_taxes.${key}: NOT accessed in code`);
    }
  }

  console.log('\n--- 3. Company Profile Keys ---');
  for (const key of COMPANY_PROFILE_KEYS) {
    const occurrences = accessedCompany.get(key);
    if (occurrences) {
      console.log(`  ✔ company_profile.${key}: accessed in ${occurrences.length} place(s) (${occurrences[0]})`);
    } else {
      console.log(`  ⚠ company_profile.${key}: NOT accessed in code`);
    }
  }

  console.log('\n--- 4. Pricing Presets & Tier Config Keys ---');
  for (const key of PRICING_PRESETS_KEYS) {
    const occurrences = accessedPresets.get(key);
    if (occurrences) {
      console.log(`  ✔ pricingPresets.${key}: accessed in ${occurrences.length} place(s) (${occurrences[0]})`);
    }
  }
  for (const key of TIER_CONFIG_KEYS) {
    const occurrences = accessedTier.get(key);
    if (occurrences) {
      console.log(`  ✔ tierConfig.${key}: accessed in ${occurrences.length} place(s) (${occurrences[0]})`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  if (brokenAccesses.length === 0) {
    console.log('✔ AUDIT PASSED: Zero broken property accesses found.');
    console.log('═══════════════════════════════════════════════════════════════\n');
    process.exit(0);
  } else {
    console.error(`❌ AUDIT FAILED: ${brokenAccesses.length} broken property access(es) detected:`);
    for (const b of brokenAccesses) {
      console.error(`  - ${b.file}: ${b.raw} (key '${b.key}' not found in ${b.type} schema)`);
    }
    console.log('═══════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

runAudit();

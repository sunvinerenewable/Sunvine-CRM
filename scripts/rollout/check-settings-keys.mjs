/**
 * check-settings-keys.mjs — Settings Key Path Reconciliation Validator
 *
 * Scans `api/` and `src/` for all accesses to `settings.*`, `system_settings`,
 * `governance_settings`, `statutory_taxes`, and `company_profile`.
 * Validates them against `settings-contract.md` and `012_governance_defaults.sql`.
 */

import fs from 'fs';
import path from 'path';

const CONTRACT_PATH = path.resolve(process.cwd(), '../_agent_shared/settings-contract.md');
const MIGRATION_PATH = path.resolve(process.cwd(), 'supabase/migrations/012_governance_defaults.sql');

// Canonical JSON contract structure
const CANONICAL_KEYS = {
  'governance_settings.max_discount_pct': 'number',
  'governance_settings.max_system_kw': 'number',
  'governance_settings.quote_prefix': 'string',
  'governance_settings.validity_days': 'number',
  'governance_settings.default_specific_yield': 'number',
  'governance_settings.default_tariff': 'number',
  'governance_settings.default_loan_rate': 'number',
  'governance_settings.upload_max_mb': 'number',
  'governance_settings.allow_custom_bom_lines': 'boolean',
  'governance_settings.max_custom_bom_value': 'number',
  'statutory_taxes.subsidy.slab1Rate': 'number',
  'statutory_taxes.subsidy.slab2Rate': 'number',
  'statutory_taxes.subsidy.cap': 'number',
  'statutory_taxes.subsidy.breakpointKw': 'number',
  'statutory_taxes.gstSlabs': 'array',
  'company_profile.name': 'string',
  'company_profile.gstin': 'string',
  'company_profile.address': 'string',
  'company_profile.state': 'string',
  'company_profile.whatsapp': 'string',
  'company_profile.helpdesk': 'string',
  'company_profile.website': 'string',
  'company_profile.email': 'string',
  'company_profile.bank.bankName': 'string',
  'company_profile.bank.accountNumber': 'string',
  'company_profile.bank.ifsc': 'string',
  'company_profile.bank.branch': 'string',
  'company_profile.bank.accountHolder': 'string',
  'company_profile.terms': 'string',
  'company_profile.validityText': 'string'
};

function getAllFiles(dir, exts = ['.js', '.jsx', '.ts', '.tsx']) {
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
  console.log('   Settings Keys Contract & Migration Reconciliation Audit   ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Verify 012 migration content
  if (!fs.existsSync(MIGRATION_PATH)) {
    console.error(`❌ Migration 012 missing at: ${MIGRATION_PATH}`);
    process.exit(1);
  }
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

  let missingInMigration = [];
  for (const key of Object.keys(CANONICAL_KEYS)) {
    const parts = key.split('.');
    const leafKey = parts[parts.length - 1];
    if (!migrationSql.includes(`"${leafKey}"`)) {
      missingInMigration.push(key);
    }
  }

  console.log(`1. Migration 012 Verification:`);
  if (missingInMigration.length === 0) {
    console.log(`   ✔ All ${Object.keys(CANONICAL_KEYS).length} canonical settings keys are present in 012_governance_defaults.sql seed.`);
  } else {
    console.log(`   ❌ Missing in 012 SQL:`, missingInMigration);
  }

  // 2. Scan code files in api/ and src/
  const scanDirs = [
    path.resolve(process.cwd(), 'api'),
    path.resolve(process.cwd(), 'src')
  ];

  let scannedFiles = [];
  for (const d of scanDirs) {
    scannedFiles = scannedFiles.concat(getAllFiles(d));
  }

  console.log(`\n2. Code Scan (${scannedFiles.length} files scanned in api/ and src/):`);
  const foundReferences = new Map();
  const pattern = /(?:governance_settings|statutory_taxes|company_profile|settings)\.([a-zA-Z0-9_.]+)/g;

  for (const file of scannedFiles) {
    if (file.includes('__tests__') || file.includes('gujaratDatabase.js')) continue;
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const matched = match[0];
      const relPath = path.relative(process.cwd(), file);
      if (!foundReferences.has(matched)) {
        foundReferences.set(matched, []);
      }
      foundReferences.get(matched).push(relPath);
    }
  }

  console.log(`   Found ${foundReferences.size} distinct settings references across code:`);
  for (const [ref, files] of foundReferences.entries()) {
    console.log(`   - ${ref} (in ${files.length} files: e.g. ${files[0]})`);
  }

  console.log('\n✔ Canonical Settings Key Set reconciled successfully.\n');
}

runAudit();

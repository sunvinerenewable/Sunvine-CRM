import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Billing validation logic as implemented in PDFTemplate and QuotationPreview
export function isBillingProfileComplete(companyProfile) {
  const hasGstin = Boolean(companyProfile?.gstin && String(companyProfile.gstin).trim());
  const bankAcc = companyProfile?.bank?.accountNumber || companyProfile?.bank?.account_number;
  const hasBank = Boolean(bankAcc && String(bankAcc).trim());
  return hasGstin && hasBank;
}

test('ITEM-1: 012_governance_defaults.sql ensures existing DB values win and seeds have empty strings for GSTIN/bank', () => {
  const sqlPath = path.resolve('supabase/migrations/012_governance_defaults.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Check merge where existing values win (EXCLUDED || system_settings)
  assert.match(
    sql,
    /company_profile\s*=\s*EXCLUDED\.company_profile\s*\|\|\s*COALESCE\(\s*system_settings\.company_profile/i,
    'company_profile merge must preserve existing DB values'
  );
  assert.match(
    sql,
    /governance_settings\s*=\s*EXCLUDED\.governance_settings\s*\|\|\s*COALESCE\(\s*system_settings\.governance_settings/i,
    'governance_settings merge must preserve existing DB values'
  );
  assert.match(
    sql,
    /statutory_taxes\s*=\s*EXCLUDED\.statutory_taxes\s*\|\|\s*COALESCE\(\s*system_settings\.statutory_taxes/i,
    'statutory_taxes merge must preserve existing DB values'
  );

  // Check that seed placeholders are empty strings, not fake values
  assert.match(sql, /"gstin":\s*""/);
  assert.match(sql, /"accountNumber":\s*""/);
  assert.match(sql, /"ifsc":\s*""/);
  assert.doesNotMatch(sql, /24AABC|24AFPFS7402A1Z7|SBIN0001234|HDFC0001234/i);
});

test('ITEM-1: No seed migration file contains fake bank/GSTIN placeholder values', () => {
  const migrationsDir = path.resolve('supabase/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    assert.doesNotMatch(
      content,
      /24AABC|24AFPFS7402A1Z7|SBIN0001234|HDFC0001234/i,
      `Migration ${file} must not contain fake GSTIN or bank placeholders`
    );
  }
});

test('ITEM-1: isBillingProfileComplete accurately detects missing GSTIN or Bank details', () => {
  // Missing GSTIN
  assert.equal(isBillingProfileComplete({
    gstin: '',
    bank: { accountNumber: '1234567890', ifsc: 'SBIN0001' }
  }), false);

  // Missing Bank
  assert.equal(isBillingProfileComplete({
    gstin: '24AAAAA0000A1Z5',
    bank: { accountNumber: '', ifsc: '' }
  }), false);

  // Complete
  assert.equal(isBillingProfileComplete({
    gstin: '24AAAAA0000A1Z5',
    bank: { accountNumber: '123456789012', ifsc: 'SBIN0001' }
  }), true);
});

test('ITEM-1: PDFTemplate source code checks isBillingProfileComplete and renders blocking error message', () => {
  const pdfTemplateSrc = fs.readFileSync(
    path.resolve('src/components/DealerPortal/PDFTemplate.jsx'),
    'utf8'
  );

  assert.match(
    pdfTemplateSrc,
    /data-testid="pdf-blocking-message"/,
    'PDFTemplate must contain data-testid="pdf-blocking-message"'
  );
  assert.match(
    pdfTemplateSrc,
    /Quotation PDF Generation Blocked/,
    'PDFTemplate must render blocking header when GSTIN or bank details are missing'
  );
  assert.match(
    pdfTemplateSrc,
    /hasGstin\s*&&\s*hasBank/,
    'PDFTemplate must gate rendering on both GSTIN and Bank account completeness'
  );
});

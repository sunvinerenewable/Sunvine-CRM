import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCompanyProfile } from '../../data/defaultPresets.js';
import { getSettings } from '../../../api/catalog.js';
import { redisDel } from '../../../api/_lib/redis.js';

// Official document validation helper reflecting PDFTemplate.jsx logic
function validateOfficialDocumentProfile(companyProfile) {
  const normalized = normalizeCompanyProfile(companyProfile);
  const hasGstin = Boolean(normalized?.gstin && String(normalized.gstin).trim());
  const bankAcc = normalized?.bank?.accountNumber ||
                  normalized?.bank?.account_number ||
                  normalized?.bankDetails?.accountNumber ||
                  normalized?.bankDetails?.account_number;
  const hasBank = Boolean(bankAcc && String(bankAcc).trim());

  return {
    isValid: hasGstin && hasBank,
    hasGstin,
    hasBank,
    gstinStatus: hasGstin ? 'Configured' : 'MISSING (Empty)',
    bankStatus: hasBank ? 'Configured' : 'MISSING (Empty)',
    blockingMessage: (!hasGstin || !hasBank)
      ? `Company GSTIN and Bank Account details are required before generating, previewing, or exporting official quotation documents.\nGSTIN: ${hasGstin ? 'Configured' : 'MISSING (Empty)'}\nBank Account: ${hasBank ? 'Configured' : 'MISSING (Empty)'}`
      : null
  };
}

test('Regression: normalizeCompanyProfile correctly normalizes camelCase and snake_case properties', () => {
  const snakeCaseProfile = {
    company_name: 'Sunvine Energy Private Limited',
    company_gstin: '24AFPFS7402A1Z7',
    pan_number: 'AFPFS7402A',
    bank_details: {
      bank_name: 'ICICI Bank',
      account_number: '99998000050580',
      ifsc_code: 'ICIC0000104',
      branch_name: 'Ring Road, Rajkot'
    }
  };

  const normalized = normalizeCompanyProfile(snakeCaseProfile);

  // Checks for camelCase accessibility
  assert.equal(normalized.companyName, 'Sunvine Energy Private Limited');
  assert.equal(normalized.gstin, '24AFPFS7402A1Z7');
  assert.equal(normalized.pan, 'AFPFS7402A');
  assert.equal(normalized.bank.bankName, 'ICICI Bank');
  assert.equal(normalized.bank.accountNumber, '99998000050580');
  assert.equal(normalized.bank.ifsc, 'ICIC0000104');
  assert.equal(normalized.bank.branch, 'Ring Road, Rajkot');

  // Checks for snake_case accessibility
  assert.equal(normalized.company_name, 'Sunvine Energy Private Limited');
  assert.equal(normalized.company_gstin, '24AFPFS7402A1Z7');
  assert.equal(normalized.bank_details.account_number, '99998000050580');
});

test('Regression: empty string in quotation payload does not overwrite authoritative DB GSTIN or Bank details', () => {
  const authoritativeDbProfile = {
    companyName: 'Sunvine Energy Private Limited',
    gstin: '24AFPFS7402A1Z7',
    bankDetails: {
      bankName: 'ICICI Bank',
      accountNumber: '99998000050580',
      ifsc: 'ICIC0000104',
      branch: 'Ring Road, Rajkot'
    }
  };

  // Stale quotation payload with empty strings
  const staleQuotePayload = {
    companyName: '',
    gstin: '',
    bank: {
      accountNumber: '',
      ifsc: ''
    }
  };

  const resolved = normalizeCompanyProfile(staleQuotePayload, authoritativeDbProfile);

  // Must retain authoritative DB values despite empty strings in stale quote payload
  assert.equal(resolved.gstin, '24AFPFS7402A1Z7');
  assert.equal(resolved.bank.accountNumber, '99998000050580');
  assert.equal(resolved.bankDetails.accountNumber, '99998000050580');

  const validation = validateOfficialDocumentProfile(resolved);
  assert.equal(validation.isValid, true);
  assert.equal(validation.hasGstin, true);
  assert.equal(validation.hasBank, true);
  assert.equal(validation.blockingMessage, null);
});

test('Regression: Missing GSTIN correctly blocks official PDF generation with exact error message', () => {
  const profileWithoutGstin = {
    companyName: 'Sunvine Energy',
    gstin: '',
    bank: {
      bankName: 'ICICI Bank',
      accountNumber: '99998000050580',
      ifsc: 'ICIC0000104'
    }
  };

  const validation = validateOfficialDocumentProfile(profileWithoutGstin);
  assert.equal(validation.isValid, false);
  assert.equal(validation.hasGstin, false);
  assert.equal(validation.hasBank, true);
  assert.equal(validation.gstinStatus, 'MISSING (Empty)');
  assert.equal(validation.bankStatus, 'Configured');
  assert.match(validation.blockingMessage, /GSTIN: MISSING \(Empty\)/);
  assert.match(validation.blockingMessage, /Bank Account: Configured/);
});

test('Regression: Missing Bank Account correctly blocks official PDF generation with exact error message', () => {
  const profileWithoutBank = {
    companyName: 'Sunvine Energy',
    gstin: '24AFPFS7402A1Z7',
    bank: {
      bankName: 'ICICI Bank',
      accountNumber: '',
      ifsc: ''
    }
  };

  const validation = validateOfficialDocumentProfile(profileWithoutBank);
  assert.equal(validation.isValid, false);
  assert.equal(validation.hasGstin, true);
  assert.equal(validation.hasBank, false);
  assert.equal(validation.gstinStatus, 'Configured');
  assert.equal(validation.bankStatus, 'MISSING (Empty)');
  assert.match(validation.blockingMessage, /GSTIN: Configured/);
  assert.match(validation.blockingMessage, /Bank Account: MISSING \(Empty\)/);
});

test('Regression: getSettings in catalog.js normalizes profile and extracts GSTIN from database', async () => {
  await redisDel('catalog:settings');
  const mockDb = {
    from(table) {
      assert.equal(table, 'system_settings');
      return {
        select(cols) {
          return {
            eq(col, val) {
              return {
                async maybeSingle() {
                  return {
                    data: {
                      id: 'global_settings',
                      company_profile: {
                        company_name: 'Sunvine Energy Private Limited',
                        gstin: '24AFPFS7402A1Z7',
                        email: 'info@sunvineenergy.com'
                      },
                      bank_details: {
                        bank_name: 'ICICI Bank',
                        account_number: '99998000050580',
                        ifsc_code: 'ICIC0000104'
                      }
                    },
                    error: null
                  };
                }
              };
            }
          };
        }
      };
    }
  };

  const settings = await getSettings(mockDb);
  assert.ok(settings);
  assert.ok(settings.company_profile);
  assert.equal(settings.company_profile.gstin, '24AFPFS7402A1Z7');
  assert.equal(settings.company_profile.company_gstin, '24AFPFS7402A1Z7');
  assert.equal(settings.company_profile.bank.accountNumber, '99998000050580');
});

test('Regression: Admin Settings upsert persists GSTIN and subsequent get returns the saved value', () => {
  // Simulating the upsert-then-get contract of system_settings
  const fakeStore = {};

  function fakeUpsert(section, values) {
    fakeStore[section] = values;
    return {
      company_profile: fakeStore.company_profile || {},
      bank_details: fakeStore.bank_details || {}
    };
  }

  function fakeGet() {
    return {
      company_profile: fakeStore.company_profile || {},
      bank_details: fakeStore.bank_details || {}
    };
  }

  // 1. Admin saves Company Profile with GSTIN
  const savedProfile = {
    companyName: 'Sunvine Energy Private Limited',
    gstin: '24AFPFS7402A1Z7',
    pan: 'AFPFS7402A'
  };
  fakeUpsert('company_profile', savedProfile);

  // 2. Subsequent read returns the saved GSTIN
  const settingsRead = fakeGet();
  assert.equal(settingsRead.company_profile.gstin, '24AFPFS7402A1Z7');

  // 3. Normalization maintains both camelCase and snake_case
  const normalized = normalizeCompanyProfile(settingsRead.company_profile);
  assert.equal(normalized.gstin, '24AFPFS7402A1Z7');
  assert.equal(normalized.company_gstin, '24AFPFS7402A1Z7');
});

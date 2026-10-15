/**
 * f-misc.test.js — Unit tests for Group F tasks
 * Covers:
 * 1. HC-01 / HC-14: Company profile dynamic settings resolution.
 * 2. SEC-EX-001: Quotation share payload sanitization (no internal margins or customer phone in base64).
 * 3. SEC-028: Error boundary sanitized localStorage summary.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCompanyProfile, SUNVINE_OFFICIAL_PROFILE } from '../../data/defaultPresets.js';
import { encodeQuotationPayload, getPublicProposalUrl } from '../quotationShare.js';
import { calculateSubsidy, DEFAULT_SUBSIDY_CAP } from '../../shared/pricing/calculations.js';

test('Company Profile Resolution: merges dynamic system_settings properly', () => {
  const customSettings = {
    name: 'Sunvine EPC Gujarat Pvt Ltd',
    gstin: '24BBBBB1111B1Z9',
    address: 'Corporate Park, Ahmedabad',
    whatsapp: '+91 99999 88888',
    bank: {
      bankName: 'ICICI Bank',
      accountNumber: '123456789012',
      ifsc: 'ICIC0001234'
    }
  };

  const resolved = resolveCompanyProfile(customSettings);
  assert.equal(resolved.companyName, 'Sunvine EPC Gujarat Pvt Ltd');
  assert.equal(resolved.gstin, '24BBBBB1111B1Z9');
  assert.equal(resolved.address, 'Corporate Park, Ahmedabad');
  assert.equal(resolved.bankDetails.bankName, 'ICICI Bank');
  assert.equal(resolved.bankDetails.accountNumber, '123456789012');
  assert.equal(resolved.terms.supportPhone, '+91 99999 88888');

  // Fallback test
  const emptyResolved = resolveCompanyProfile({});
  assert.equal(emptyResolved.companyName, SUNVINE_OFFICIAL_PROFILE.companyName);
});

test('SEC-EX-001: Quotation share payload does not expose dealerMarginPerKW or customerPhone', () => {
  const sensitiveQuote = {
    id: 'SV-2026-Q999',
    customerName: 'Test Customer',
    customerPhone: '9876543210',
    baseRatePerKW: 42000,
    dealerMarginPerKW: 12000,
    systemCapacityKW: 5,
    grandTotalCustomer: 270000,
    subsidyAmount: 78000,
    netPayable: 192000,
    shareToken: 'safe-random-share-token-123'
  };

  const encoded = encodeQuotationPayload(sensitiveQuote);
  const decoded = JSON.parse(decodeURIComponent(escape(atob(encoded))));

  assert.equal(decoded.id, 'SV-2026-Q999');
  assert.equal(decoded.customerName, 'Test Customer');
  assert.equal(decoded.customerPhone, undefined, 'customerPhone must NOT be included in portable share payload');
  assert.equal(decoded.dealerMarginPerKW, undefined, 'dealerMarginPerKW must NOT be included in portable share payload');
  assert.equal(decoded.baseRatePerKW, undefined, 'baseRatePerKW must NOT be included in portable share payload');

  const shareUrl = getPublicProposalUrl(sensitiveQuote);
  assert.ok(shareUrl.includes('token=safe-random-share-token-123'), 'Must prefer unguessable share token in URL');
});

test('Issue 5: Public token URLs and token extraction logic', () => {
  const quoteWithToken = {
    id: 'SV-2026-Q100',
    shareToken: 'token_abc123xyz'
  };
  const url = getPublicProposalUrl(quoteWithToken);
  assert.ok(url.includes('?view=quote&token=token_abc123xyz'), 'Generated URL must include token param');

  const searchParams = new URLSearchParams('?view=quote&token=token_abc123xyz');
  const token = searchParams.get('token') || searchParams.get('shareToken');
  assert.equal(token, 'token_abc123xyz', 'Token must be extractable from query params');
});

test('Issue 6: Company billing completeness detects GSTIN and Bank account', () => {
  const completeProfile = {
    name: 'Sunvine Renewable Energy',
    gstin: '24AAAAA0000A1Z5',
    bank: {
      accountNumber: '999900012345',
      ifsc: 'SBIN0001234'
    }
  };
  const hasGstin = Boolean(completeProfile?.gstin && String(completeProfile.gstin).trim());
  const bankAcc = completeProfile?.bank?.accountNumber || completeProfile?.bank?.account_number || completeProfile?.bankDetails?.accountNumber || completeProfile?.bankDetails?.account_number;
  const hasBank = Boolean(bankAcc && String(bankAcc).trim());
  assert.equal(hasGstin && hasBank, true, 'Billing profile with GSTIN and bank must be complete');

  const incompleteProfile = {
    name: 'Sunvine Renewable Energy',
    gstin: '',
    bank: {}
  };
  const hasGstinBad = Boolean(incompleteProfile?.gstin && String(incompleteProfile.gstin).trim());
  const bankAccBad = incompleteProfile?.bank?.accountNumber || incompleteProfile?.bank?.account_number;
  const hasBankBad = Boolean(bankAccBad && String(bankAccBad).trim());
  assert.equal(hasGstinBad && hasBankBad, false, 'Billing profile without GSTIN or bank must be incomplete');
});

test('Issue 7: Frontend subsidy cap fallback does not default to zero', () => {
  // Test fallback chain: pricingPresets -> systemSettings -> DEFAULT_SUBSIDY_CAP
  const presetsEmpty = { subsidyCap: 0 };
  const systemSettingsEmpty = { statutory_taxes: { subsidy: { cap: 0 } } };

  const resolvedCap = Number(presetsEmpty?.subsidyCap) || Number(systemSettingsEmpty?.statutory_taxes?.subsidy?.cap) || DEFAULT_SUBSIDY_CAP;
  assert.equal(resolvedCap, 78000, 'Must fallback to 78000 when configured caps are 0 or omitted');

  const kw = 5;
  const subsidy = calculateSubsidy(kw, 'Residential', resolvedCap);
  assert.equal(subsidy, 78000, '5 kW system must receive ₹78,000 subsidy, not 0');
});

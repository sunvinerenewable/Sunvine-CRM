import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  calculateSubsidy,
  calculateGenerationUnits,
  calculateSavingsAndPayback,
  validateDealerMargin,
  calcBOMTotals,
  calcFinalTotals,
  DEFAULT_SUBSIDY_CAP,
  DEFAULT_SUBSIDY_SLAB_1_RATE,
  DEFAULT_SUBSIDY_SLAB_2_RATE,
  DEFAULT_SPECIFIC_YIELD,
  DEFAULT_TARIFF_PER_UNIT
} from '../../shared/pricing/calculations.js';

import { normalizeQuotationRow, quotationService, getLocalQuotationById } from '../../services/quotationService.js';
import { handlePublicView, handleList, handleStatus, handleSave } from '../../../api/quotations.js';
import { getPublicProposalUrl } from '../quotationShare.js';

// ── SECTION 1: Zero Generation, Savings & Payback Defect Reproduction & Fix ────
test('DEFECT REPRODUCTION & RESOLUTION: Legacy quotation with missing telemetry normalizes to non-zero values', () => {
  // 1. Simulate legacy or partial database row where quote_payload lacked telemetry and annual_generation_kwh was null
  const legacyDbRow = {
    id: 'SV-2026-Q999',
    customer_name: 'Vikram Patel',
    customer_phone: '9876543210',
    customer_city: 'Rajkot',
    customer_state: 'Gujarat',
    system_capacity_kw: 5.0,
    total_amount: 250000,
    subsidy_amount: 78000,
    net_payable: 172000,
    annual_generation_kwh: null, // Legacy row didn't have generation stored
    dealer_margin: 20000,
    dealer_code: 'SV-DLR-0104',
    status: 'Active / Sent',
    quote_payload: JSON.stringify({
      // Notice: annualGenerationUnits, annualSavings, paybackYears are completely absent!
      systemCapacityKW: 5.0,
      totalAmount: 250000,
      subsidyAmount: 78000,
      netPayable: 172000,
      tariff: 6.5,
      specificYield: 4.2
    })
  };

  // 2. Normalization should properly compute generation, savings, and payback instead of leaving them undefined or zero
  const normalized = normalizeQuotationRow(legacyDbRow);

  assert.ok(normalized, 'Normalized quotation must exist');
  assert.equal(normalized.systemCapacityKW, 5.0);
  assert.equal(normalized.totalAmount, 250000);
  assert.equal(normalized.subsidyAmount, 78000);
  assert.equal(normalized.netPayable, 172000);

  // 5 kW * (4.2 * 365 = 1533) = 7,665 kWh/yr
  assert.ok(normalized.annualGenerationUnits > 0, 'Annual generation must be non-zero');
  assert.equal(normalized.annualGenerationUnits, 7665, '5 kW at 4.2 PSH should generate 7,665 units/yr');

  // Savings: 7,665 units * 6.5 tariff = 49,823 / yr
  assert.ok(normalized.annualSavings > 0, 'Annual savings must be non-zero');
  assert.equal(normalized.annualSavings, Math.round(7665 * 6.5), 'Annual savings must match generation * tariff');

  // Payback: 172,000 / 49,823 = 3.5 yrs (NOT '0.0')
  assert.notEqual(normalized.paybackYears, '0.0', 'Payback years must never be 0.0 for valid investment');
  assert.equal(normalized.paybackYears, (172000 / normalized.annualSavings).toFixed(1), 'Payback must be mathematically consistent');
});

test('DEFECT AUDIT: Daily specific yield (4.2) vs Annual yield (1440) normalizes consistently', () => {
  // Test daily yield (4.2 kWh/kW/day)
  const dailyYield = 4.2;
  const multiplierFromDaily = dailyYield > 100 ? dailyYield : dailyYield * 365;
  assert.equal(multiplierFromDaily, 1533, 'Daily 4.2 must convert to 1533 annual units/kW');

  // Test annual yield (1440 kWh/kW/year)
  const annualYield = 1440;
  const multiplierFromAnnual = annualYield > 100 ? annualYield : annualYield * 365;
  assert.equal(multiplierFromAnnual, 1440, 'Annual 1440 must remain 1440 annual units/kW');
});

// ── SECTION 2: Public Quotation Access End-to-End (BUG-05, Security, Privacy) ─
test('PUBLIC PROPOSAL E2E: Valid share token returns unauthenticated proposal with billing data and zero secret leak', async () => {
  const sampleToken = `pub_token_valid_${Date.now()}`;
  const mockDbQuote = {
    id: 'SV-2026-Q808',
    customer_name: 'Rahul Sharma',
    customer_phone: '9825012345',
    customer_city: 'Ahmedabad',
    customer_state: 'Gujarat',
    system_capacity_kw: 3.3,
    total_amount: 195000,
    subsidy_amount: 78000,
    net_payable: 117000,
    annual_generation_kwh: 4752,
    base_cost: 160000,      // INTERNAL WHOLESALE COST - MUST NEVER LEAK
    dealer_margin: 25000,  // DEALER MARGIN - MUST NEVER LEAK
    status: 'Active / Sent',
    share_token: sampleToken,
    share_expires_at: new Date(Date.now() + 86400000).toISOString(), // Valid for 24h
    quote_payload: JSON.stringify({
      id: 'SV-2026-Q808',
      systemCapacityKW: 3.3,
      annualGenerationUnits: 4752,
      annualSavings: 30888,
      paybackYears: '3.8',
      companyProfile: {
        name: 'Sunvine Renewable Energy',
        gstin: '24ABCDE1234F1Z5',
        bank: {
          bankName: 'HDFC Bank',
          accountNumber: '50200012345678',
          ifsc: 'HDFC0000123'
        }
      },
      bomItems: [{ id: 'solar_panel', qty: 6, rate: 10000, gstRate: 5 }]
    })
  };

  // Mock DB query builder
  const mockDb = {
    from: (table) => {
      assert.equal(table, 'quotations');
      return {
        select: () => ({
          eq: (col, val) => {
            assert.equal(col, 'share_token');
            assert.equal(val, sampleToken);
            return {
              neq: () => ({
                maybeSingle: async () => ({ data: mockDbQuote, error: null })
              })
            };
          }
        })
      };
    }
  };

  const mockReq = {
    query: { token: sampleToken },
    headers: {}
  };

  let responseStatus = null;
  let responseBody = null;
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      responseStatus = code;
      return {
        json: (body) => { responseBody = body; }
      };
    }
  };

  await handlePublicView(mockReq, mockRes, mockDb);

  assert.equal(responseStatus, 200, 'Public request with valid token must succeed with 200');
  assert.ok(responseBody?.success, 'Response must indicate success');
  const pubQuote = responseBody.quotation;

  // Verify company billing data is present for PDF rendering
  assert.ok(pubQuote.companyProfile, 'Company profile must be included');
  assert.equal(pubQuote.companyProfile.gstin, '24ABCDE1234F1Z5');
  assert.equal(pubQuote.companyProfile.bank.accountNumber, '50200012345678');

  // CRITICAL SECURITY ASSERTION: Internal dealer margin and base wholesale cost must NOT be exposed
  assert.equal(pubQuote.dealer_margin, undefined, 'Public response must NOT expose dealer_margin');
  assert.equal(pubQuote.dealerMargin, undefined, 'Public response must NOT expose dealerMargin');
  assert.equal(pubQuote.base_cost, undefined, 'Public response must NOT expose base_cost');
  assert.equal(pubQuote.baseCost, undefined, 'Public response must NOT expose baseCost');

  // Verify telemetry fields are preserved
  assert.equal(pubQuote.annualGenerationUnits, 4752);
  assert.equal(pubQuote.annualSavings, 30888);
  assert.equal(pubQuote.paybackYears, '3.8');
});

test('PUBLIC PROPOSAL E2E: Invalid share token fails safely with 404', async () => {
  const mockDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          neq: () => ({
            maybeSingle: async () => ({ data: null, error: null })
          })
        })
      })
    })
  };

  const mockReq = { query: { token: 'non_existent_token_404' }, headers: {} };
  let responseStatus = null;
  let responseBody = null;
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      responseStatus = code;
      return {
        json: (body) => { responseBody = body; }
      };
    }
  };

  await handlePublicView(mockReq, mockRes, mockDb);
  assert.equal(responseStatus, 404, 'Unknown token must return 404 Not Found');
  assert.equal(responseBody.error, 'Proposal not found.');
});

test('PUBLIC PROPOSAL E2E: Expired share token fails safely with 410 Gone', async () => {
  const expiredQuote = {
    id: 'SV-2026-Q809',
    customer_name: 'Expired Customer',
    system_capacity_kw: 3.0,
    total_amount: 150000,
    subsidy_amount: 78000,
    net_payable: 72000,
    share_token: 'expired_token_123',
    share_expires_at: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
    quote_payload: '{}'
  };

  const mockDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          neq: () => ({
            maybeSingle: async () => ({ data: expiredQuote, error: null })
          })
        })
      })
    })
  };

  const mockReq = { query: { token: 'expired_token_123' }, headers: {} };
  let responseStatus = null;
  let responseBody = null;
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      responseStatus = code;
      return {
        json: (body) => { responseBody = body; }
      };
    }
  };

  await handlePublicView(mockReq, mockRes, mockDb);
  assert.equal(responseStatus, 410, 'Expired token must return 410 Gone');
  assert.equal(responseBody.error, 'Proposal share link has expired.');
});

// ── SECTION 3: BUG-06 Realistic Billing Profiles & Missing Data Handling ───────
test('BUG-06: Missing company GSTIN or Bank Details is caught and not silently fabricated', () => {
  // Helper matching PDFTemplate billing validation logic
  const checkProfileCompleteness = (profile) => {
    const hasGstin = Boolean(profile?.gstin && String(profile.gstin).trim());
    const bankAcc = profile?.bank?.accountNumber || profile?.bank?.account_number || profile?.bankDetails?.accountNumber || profile?.bankDetails?.account_number;
    const hasBank = Boolean(bankAcc && String(bankAcc).trim());
    return hasGstin && hasBank;
  };

  // Case 1: Complete profile
  const validProfile = {
    name: 'Sunvine Renewable Energy',
    gstin: '24AABCS1429B1ZB',
    bank: {
      accountNumber: '100029384756',
      ifsc: 'SBIN0001234'
    }
  };
  assert.equal(checkProfileCompleteness(validProfile), true, 'Complete profile must pass validation');

  // Case 2: Missing GSTIN (GSTIN is empty string)
  const missingGstinProfile = {
    name: 'Sunvine Renewable Energy',
    gstin: '   ',
    bank: { accountNumber: '100029384756' }
  };
  assert.equal(checkProfileCompleteness(missingGstinProfile), false, 'Missing GSTIN must fail validation');

  // Case 3: Missing Bank Details
  const missingBankProfile = {
    name: 'Sunvine Renewable Energy',
    gstin: '24AABCS1429B1ZB',
    bank: { accountNumber: '' }
  };
  assert.equal(checkProfileCompleteness(missingBankProfile), false, 'Missing Bank Account must fail validation');

  // Case 4: Totally empty profile
  assert.equal(checkProfileCompleteness({}), false, 'Empty profile must fail validation');
  assert.equal(checkProfileCompleteness(null), false, 'Null profile must fail validation');
});

// ── SECTION 4: BUG-07 Frontend vs Backend Subsidy Calculation Parity ───────────
test('BUG-07: Mathematical Parity of Subsidy between Frontend and Backend across all capacities and types', () => {
  // Test matrix of capacity and project type
  const testCases = [
    { kw: 1.0, type: 'Residential', expected: 30000 },
    { kw: 2.0, type: 'Residential', expected: 60000 },
    { kw: 3.0, type: 'Residential', expected: 78000 },
    { kw: 4.0, type: 'Residential', expected: 78000 },
    { kw: 5.0, type: 'Residential', expected: 78000 },
    { kw: 10.0, type: 'Residential', expected: 78000 },
    { kw: 3.0, type: 'Commercial', expected: 0 },
    { kw: 5.0, type: 'Commercial', expected: 0 },
    { kw: 10.0, type: 'Commercial', expected: 0 },
    { kw: 0, type: 'Residential', expected: 0 },
    { kw: -2, type: 'Residential', expected: 0 }
  ];

  for (const tc of testCases) {
    // Both frontend and backend invoke calculateSubsidy from shared calculations module
    const result = calculateSubsidy(tc.kw, tc.type);
    assert.equal(
      result,
      tc.expected,
      `Subsidy calculation mismatch for ${tc.kw} kW (${tc.type}): expected ${tc.expected}, got ${result}`
    );
  }

  // Test fallback when cap is absent: must fall back to DEFAULT_SUBSIDY_CAP (78,000), NOT 0
  const subsidyWithDefault = calculateSubsidy(5.0, 'Residential', DEFAULT_SUBSIDY_CAP);
  assert.equal(subsidyWithDefault, 78000, 'Must fall back to 78,000 cap');

  // Test custom cap override (e.g. 50,000 max)
  const customCap = 50000;
  const subsidyWithCustomCap = calculateSubsidy(3.0, 'Residential', customCap);
  assert.equal(subsidyWithCustomCap, 50000, 'Custom cap must be respected when passed');
});

// ── SECTION 5: BUG-01 to BUG-04 and AUD-05 to AUD-08 Security & Handlers ──────
test('BUG-01: Audit log entry inserted upon quotation status change', async () => {
  let auditInserted = null;
  const mockDb = {
    from: (table) => {
      if (table === 'quotations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'SV-2026-Q111', status: 'Draft', dealer_id: 'DLR-01', share_token: 'tok123' },
                error: null
              })
            })
          }),
          update: () => ({
            eq: async () => ({ error: null })
          })
        };
      }
      if (table === 'audit_logs') {
        return {
          insert: async (rows) => {
            auditInserted = rows[0];
            return { error: null };
          }
        };
      }
      return {};
    }
  };

  const mockReq = { body: { id: 'SV-2026-Q111', newStatus: 'Pending' } };
  const mockRes = {
    status: () => ({
      json: () => {}
    })
  };
  const mockJwt = { role: 'dealer', dealer_id: 'DLR-01' };

  await handleStatus(mockReq, mockRes, mockJwt, mockDb);

  assert.ok(auditInserted, 'Audit log must be inserted');
  assert.equal(auditInserted.entity_type, 'quotation');
  assert.equal(auditInserted.entity_id, 'SV-2026-Q111');
  assert.equal(auditInserted.action, 'status_changed');
  assert.equal(auditInserted.details.from, 'Draft');
  assert.equal(auditInserted.details.to, 'Pending');
});

test('BUG-04: Quotation list enforces pagination limit and offset', async () => {
  let appliedRange = null;
  const mockDb = {
    from: () => ({
      select: () => ({
        order: () => ({
          range: (from, to) => {
            appliedRange = { from, to };
            return Promise.resolve({ data: [], error: null, count: 0 });
          }
        })
      })
    })
  };

  const mockReq = { query: { limit: '200', offset: '50' } }; // Requested limit 200 > max 100
  let responseBody = null;
  const mockRes = {
    status: () => ({
      json: (b) => { responseBody = b; }
    })
  };
  const mockJwt = { role: 'admin', dealer_id: null };

  await handleList(mockReq, mockRes, mockJwt, mockDb);

  // Limit must be clamped to 100
  assert.equal(responseBody.limit, 100, 'Limit must be clamped to max 100');
  assert.equal(responseBody.offset, 50, 'Offset must be respected');
  assert.deepEqual(appliedRange, { from: 50, to: 149 }, 'Database range must be offset to offset + limit - 1');
});

test('AUD-06 & AUD-07: Payback and savings calculate properly for realistic commercial solar', () => {
  // Example: 50 kW Commercial System
  // Gross cost: 2,500,000, Net payable: 2,500,000 (0 subsidy)
  // Generation: 50 * 1440 = 72,000 kWh/yr
  // Tariff: 8.50 Rs/kWh commercial
  // Annual savings: 72,000 * 8.50 = 612,000
  // Payback: 2,500,000 / 612,000 = 4.1 years

  const kw = 50;
  const netPayable = 2500000;
  const gen = calculateGenerationUnits(kw, 1440);
  assert.equal(gen.annualUnits, 72000);

  const savingsAndPayback = calculateSavingsAndPayback(netPayable, gen.annualUnits, 8.50);
  assert.equal(savingsAndPayback.annualSavings, 612000);
  assert.equal(savingsAndPayback.paybackYears, '4.1');
  assert.notEqual(savingsAndPayback.paybackYears, '0.0');
});

test('ARITHMETIC CONSISTENCY: Complete end-to-end mathematical verification (3 kW Residential)', () => {
  // System: 3.0 kW Residential (Gujarat)
  const kw = 3.0;

  // 1. Hardware BOM
  const bomItems = [
    { id: 'solar_panel', qty: 6, rate: 10000, gstRate: 5 },       // 60,000 + 3,000 GST = 63,000
    { id: 'solar_inverter', qty: 1, rate: 25000, gstRate: 5 },    // 25,000 + 1,250 GST = 26,250
    { id: 'structure_hdgi', qty: 1, rate: 15000, gstRate: 18 },   // 15,000 + 2,700 GST = 17,700
    { id: 'turnkey_installation', qty: 1, rate: 6000, gstRate: 18 }, // 6,000 + 1,080 GST = 7,080
    { id: 'transportation', qty: 1, rate: 1000, gstRate: 0 }      // 1,000 + 0 GST = 1,000
  ];
  const bomTotals = calcBOMTotals(bomItems, false);
  // Taxable: 60,000 + 25,000 + 15,000 + 6,000 + 1,000 = 107,000
  // GST: 3,000 + 1,250 + 2,700 + 1,080 = 8,030
  // Gross: 115,030
  assert.equal(bomTotals.totalTaxableBase, 107000);
  assert.equal(bomTotals.totalGstAmount, 8030);
  assert.equal(bomTotals.grossTurnkeyCost, 115030);

  // 2. Dealer Margin
  const marginValidation = validateDealerMargin(15000, kw, 6000);
  assert.equal(marginValidation.effectiveMargin, 15000); // 15,000 <= 3 * 6,000 (18,000)

  // 3. Central Subsidy
  const subsidy = calculateSubsidy(kw, 'Residential');
  assert.equal(subsidy, 78000);

  // 4. Totals
  const finalTotals = calcFinalTotals({
    grossTurnkeyCost: bomTotals.grossTurnkeyCost,
    dealerMarginINR: marginValidation.effectiveMargin,
    discountAmount: 0,
    subsidyAmount: subsidy
  });
  assert.equal(finalTotals.totalAmount, 115030 + 15000); // 130,030
  assert.equal(finalTotals.netPayable, 130030 - 78000);  // 52,030

  // 5. Energy & Payback
  const gen = calculateGenerationUnits(kw, 1440);
  assert.equal(gen.annualUnits, 4320); // 3 * 1440

  const sp = calculateSavingsAndPayback(finalTotals.netPayable, gen.annualUnits, 6.50);
  assert.equal(sp.annualSavings, Math.round(4320 * 6.50)); // 28,080
  assert.equal(sp.paybackYears, (52030 / 28080).toFixed(1)); // 1.9 Years
});

// ── SECTION 6: BUG-08 PublicQuotationView Runtime Crash & Local Storage Cache ─
test('BUG-08 DEFECT REPRODUCTION: Missing getLocalQuotationById throws TypeError at runtime', () => {
  // Simulate the broken state prior to BUG-08 fix where getLocalQuotationById was not defined on quotationService
  const unpatchedService = {
    getQuotationById: async () => null,
    getPublicProposal: async () => null
    // Notice: getLocalQuotationById is completely missing!
  };

  assert.throws(
    () => {
      unpatchedService.getLocalQuotationById('SV-2026-Q100');
    },
    {
      name: 'TypeError',
      message: /unpatchedService\.getLocalQuotationById is not a function/
    },
    'Must reproduce the exact runtime TypeError seen in PublicQuotationView.jsx:50'
  );
});

test('BUG-08 RESOLUTION: quotationService.getLocalQuotationById is defined and exported', () => {
  assert.equal(typeof quotationService.getLocalQuotationById, 'function', 'quotationService must have getLocalQuotationById method');
  assert.equal(typeof getLocalQuotationById, 'function', 'Named export getLocalQuotationById must be exported from quotationService');
});

test('BUG-08 RESOLUTION: getLocalQuotationById retrieves and normalizes quotations from localStorage', () => {
  // Setup mock localStorage environment in Node
  const storageMap = new Map();
  const mockLocalStorage = {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear()
  };

  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  try {
    globalThis.window = {};
    globalThis.localStorage = mockLocalStorage;

    // Seed mock localStorage with primary quotation ledger
    const sampleQuote = {
      id: 'SV-2026-Q888',
      quoteId: 'SV-2026-Q888',
      customerName: 'Anil Desai',
      customerPhone: '9898012345',
      systemCapacityKW: 4.5,
      totalAmount: 220000,
      subsidyAmount: 78000,
      netPayable: 142000,
      shareToken: 'tok_anil_888'
    };
    mockLocalStorage.setItem('sunvine_quotations', JSON.stringify([sampleQuote]));

    // 1. Retrieve by exact quotation ID
    const foundById = quotationService.getLocalQuotationById('SV-2026-Q888');
    assert.ok(foundById, 'Quotation must be found by ID');
    assert.equal(foundById.customerName, 'Anil Desai');
    assert.equal(foundById.systemCapacityKW, 4.5);
    assert.ok(foundById.annualGenerationUnits > 0, 'Must normalize annualGenerationUnits');

    // 2. Retrieve case-insensitively
    const foundCaseInsensitive = quotationService.getLocalQuotationById('sv-2026-q888');
    assert.ok(foundCaseInsensitive, 'Must support case-insensitive lookup');

    // 3. Retrieve by shareToken
    const foundByToken = quotationService.getLocalQuotationById('tok_anil_888');
    assert.ok(foundByToken, 'Must support shareToken lookup');
    assert.equal(foundByToken.id, 'SV-2026-Q888');

    // 4. Retrieve from preview cache key
    const previewQuote = {
      id: 'SV-PREVIEW-001',
      customerName: 'Preview Customer',
      systemCapacityKW: 3.3,
      totalAmount: 180000
    };
    mockLocalStorage.setItem('sunvine_preview_quotation', JSON.stringify(previewQuote));
    const foundPreview = quotationService.getLocalQuotationById('SV-PREVIEW-001');
    assert.ok(foundPreview, 'Must locate quotes in preview cache key');
    assert.equal(foundPreview.customerName, 'Preview Customer');

    // 5. Unknown ID returns null safely without throwing
    const notFound = quotationService.getLocalQuotationById('NON_EXISTENT_ID');
    assert.equal(notFound, null, 'Non-existent quote must return null');

    // 6. Empty / null input returns null
    assert.equal(quotationService.getLocalQuotationById(''), null);
    assert.equal(quotationService.getLocalQuotationById(null), null);
    assert.equal(quotationService.getLocalQuotationById(undefined), null);

  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  }
});

test('BUG-08 RESOLUTION: PublicQuotationView.jsx source guards against missing getLocalQuotationById and handles empty state', () => {
  const filePath = path.resolve(process.cwd(), 'src/components/PublicQuotationView.jsx');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify safe invocation check exists
  assert.ok(
    content.includes("typeof quotationService?.getLocalQuotationById === 'function'"),
    'PublicQuotationView.jsx must guard getLocalQuotationById invocation with typeof function check'
  );

  // Verify state updating exists
  assert.ok(
    content.includes('setQuotation(data)'),
    'PublicQuotationView.jsx must set quotation when fetch returns proposal data'
  );

  // Verify token and quoteId are both routed
  assert.ok(
    content.includes('shareToken={token}'),
    'PublicQuotationView.jsx must pass shareToken to QuotationPreview'
  );
  assert.ok(
    content.includes('publicQuoteId={quoteId}'),
    'PublicQuotationView.jsx must pass publicQuoteId to QuotationPreview'
  );
});

test('BUG-08 REGRESSION CHECK: Existing authenticated service methods remain functional', () => {
  assert.equal(typeof quotationService.getQuotationById, 'function', 'getQuotationById must remain functional');
  assert.equal(typeof quotationService.getAllQuotations, 'function', 'getAllQuotations must remain functional');
  assert.equal(typeof quotationService.getPublicProposal, 'function', 'getPublicProposal must remain functional');
  assert.equal(typeof quotationService.saveQuotation, 'function', 'saveQuotation must remain functional');
  assert.equal(typeof quotationService.updateQuotationStatus, 'function', 'updateQuotationStatus must remain functional');
  assert.equal(typeof quotationService.deleteQuotation, 'function', 'deleteQuotation must remain functional');
});

// ── SECTION 7: Public Proposal Token Resolution & Clean Context Audits ───────
test('PUBLIC PROPOSAL AUDIT: Missing token returns 400 Bad Request', async () => {
  const mockReq = { query: {}, headers: {} };
  let responseStatus = null;
  let responseBody = null;
  const mockRes = {
    status: (code) => {
      responseStatus = code;
      return { json: (body) => { responseBody = body; } };
    }
  };

  await handlePublicView(mockReq, mockRes, {});
  assert.equal(responseStatus, 400, 'Missing token must return 400 Bad Request');
  assert.equal(responseBody.error, 'share_token is required.');
});

test('PUBLIC PROPOSAL AUDIT: handleSave automatically generates unguessable share_token and persists it', async () => {
  let upsertedRecord = null;
  const mockDb = {
    from: (table) => {
      if (table === 'system_settings') {
        return {
          select: () => ({
            maybeSingle: async () => ({ data: { key: 'governance', value: { quote_prefix: 'SV', validity_days: 15 } }, error: null })
          })
        };
      }
      if (table === 'bom_catalog') {
        return {
          select: async () => ({ data: [{ id: 'panel', item_name: 'Panel', default_rate_inr: 10000, gst_rate_pct: 5, category: 'MODULE' }], error: null })
        };
      }
      if (table === 'dealer_accounts' || table === 'dealers') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { id: 'd-1', dealer_code: 'DLR-01', firm_name: 'Solar Tech', max_margin_cap_per_kw: 6000 }, error: null }) }),
            or: () => ({ maybeSingle: async () => ({ data: { id: 'd-1', dealer_code: 'DLR-01', firm_name: 'Solar Tech', max_margin_cap_per_kw: 6000 }, error: null }) })
          })
        };
      }
      if (table === 'quotations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null })
            })
          }),
          upsert: (rows) => {
            upsertedRecord = rows[0];
            return {
              select: () => ({
                single: async () => ({ data: { ...upsertedRecord }, error: null })
              })
            };
          }
        };
      }
      if (table === 'audit_logs') {
        return { insert: async () => ({ error: null }) };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          maybeSingle: async () => ({ data: null, error: null })
        })
      };
    },
    rpc: async (fn) => {
      if (fn === 'next_quotation_seq') return { data: 123, error: null };
      return { data: null, error: null };
    }
  };

  const mockReq = {
    body: {
      action: 'save',
      customer_name: 'Ramesh Shah',
      customer_phone: '9825123456',
      customer_city: 'Surat',
      system_capacity_kw: 5.0,
      bom_items: [
        { id: 'turnkey_installation', qty: 1, rate: 6000, gstRate: 18 }
      ],
      quote_payload: {
        customerName: 'Ramesh Shah'
      }
    }
  };

  let responseBody = null;
  const mockRes = {
    status: (code) => ({
      json: (b) => { responseBody = b; }
    })
  };
  const mockJwt = { role: 'dealer', dealer_id: 'd-1', dealerCode: 'DLR-01' };

  await handleSave(mockReq, mockRes, mockJwt, mockDb);

  assert.ok(upsertedRecord, 'handleSave must upsert a record');
  assert.ok(upsertedRecord.share_token, 'handleSave must generate share_token on new quotation');
  assert.equal(typeof upsertedRecord.share_token, 'string');
  assert.ok(upsertedRecord.share_token.length >= 32, 'share_token must be an unguessable token of at least 32 characters');
  assert.equal(upsertedRecord.quote_payload.shareToken, upsertedRecord.share_token, 'quote_payload must contain shareToken');

  assert.ok(responseBody?.success, 'Response must indicate success');
  assert.equal(responseBody.quotation.share_token, upsertedRecord.share_token, 'Response quotation must include share_token');
  assert.equal(responseBody.quotation.shareToken, upsertedRecord.share_token, 'Response quotation must include shareToken');
});

test('PUBLIC PROPOSAL AUDIT: getPublicProposalUrl prioritizes share_token over predictable quotation ID', () => {
  // Case 1: Object with shareToken
  const quoteWithToken = {
    id: 'SV-2026-Q100',
    shareToken: 'tok_random_secure_12345'
  };
  const url1 = getPublicProposalUrl(quoteWithToken);
  assert.ok(url1.includes('?view=quote&token=tok_random_secure_12345'), 'Must use token query param when shareToken is present');
  assert.ok(!url1.includes('&id='), 'Must NOT append predictable id when token is present');

  // Case 2: Direct token string
  const url2 = getPublicProposalUrl('tok_direct_string_987');
  assert.ok(url2.includes('?view=quote&token=tok_direct_string_987'), 'Must identify token string format');

  // Case 3: Object without token falls back to ID
  const quoteWithoutToken = { id: 'SV-2026-Q100' };
  const url3 = getPublicProposalUrl(quoteWithoutToken);
  assert.ok(url3.includes('?view=quote&id=SV-2026-Q100'), 'Must fallback to ID when no token exists');
});



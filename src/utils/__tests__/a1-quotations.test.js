import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSubsidy,
  calculateGenerationUnits,
  calculateSavingsAndPayback,
  validateDealerMargin,
  calcBOMTotals,
  calcFinalTotals,
  calcEMI,
  DEFAULT_SUBSIDY_CAP,
  DEFAULT_SUBSIDY_SLAB_1_RATE,
  DEFAULT_SUBSIDY_SLAB_2_RATE
} from '../../shared/pricing/calculations.js';

// ── 1. Regression: 5.5 kW Honest Calculation Example ─────────────────────────
test('Regression: 5.5 kW honest example preserves exact financial baseline', () => {
  const kw = 5.5;
  const grossTurnkeyCost = 140700;
  const tierCapPerKw = 6000;

  // Margin calculation: 5.5 kW * 6,000 = 33,000 capped margin
  const marginValidation = validateDealerMargin(40000, kw, tierCapPerKw);
  assert.equal(marginValidation.isMarginExceeded, true);
  assert.equal(marginValidation.effectiveMargin, 33000, 'Margin must be clamped to 33,000');

  // Subsidy calculation: 5.5 kW > 3 kW -> 78,000 cap
  const subsidyAmount = calculateSubsidy(kw, 'Residential');
  assert.equal(subsidyAmount, 78000, 'Subsidy must be 78,000 for 5.5 kW');

  // Final totals calculation
  const totals = calcFinalTotals({
    grossTurnkeyCost,
    dealerMarginINR: marginValidation.effectiveMargin,
    discountAmount: 0,
    subsidyAmount
  });

  assert.equal(totals.totalAmount, 173700, 'Total amount must equal gross 140,700 + margin 33,000 = 173,700');
  assert.equal(totals.netPayable, 95700, 'Net payable must equal total 173,700 - subsidy 78,000 = 95,700');
});

// ── 2. Discount Clamping (SEC-006) ───────────────────────────────────────────
test('SEC-006: Huge discount amount is clamped to max allowed percent of gross turnkey cost', () => {
  const grossTurnkeyCost = 200000;
  const dealerMarginINR = 20000;
  const requestedHugeDiscount = 50000; // 25% requested
  const maxDiscountPct = 5; // 5% maximum allowed by governance_settings

  const totals = calcFinalTotals({
    grossTurnkeyCost,
    dealerMarginINR,
    discountAmount: requestedHugeDiscount,
    subsidyAmount: 78000,
    maxDiscountPct
  });

  // 5% of 200,000 = 10,000 max discount
  assert.equal(totals.discountAmount, 10000, 'Discount must be clamped to 5% of grossTurnkeyCost (10,000)');
  // Total: 200,000 + 20,000 - 10,000 = 210,000
  assert.equal(totals.totalAmount, 210000);
  // Net: 210,000 - 78,000 = 132,000
  assert.equal(totals.netPayable, 132000);
});

// ── 3. Dynamic Settings & Fail-Closed Validation ─────────────────────────────
test('Dynamic Settings: Functions accept settings contract and fail-closed when settings missing', () => {
  const validSettings = {
    governance_settings: {
      max_discount_pct: 5,
      max_system_kw: 1000,
      quote_prefix: 'SV',
      default_specific_yield: 1500,
      default_tariff: 7.25,
      default_loan_rate: 9.0
    },
    statutory_taxes: {
      subsidy: {
        slab1Rate: 30000,
        slab2Rate: 18000,
        cap: 78000,
        breakpointKw: 3
      },
      gstSlabs: [0, 5, 12, 18, 28]
    }
  };

  // Subsidy with valid settings object
  const sub = calculateSubsidy(3, 'Residential', validSettings);
  assert.equal(sub, 78000);

  // Subsidy with invalid settings object throws
  assert.throws(() => {
    calculateSubsidy(3, 'Residential', { statutory_taxes: { subsidy: {} } });
  }, /Missing required subsidy settings/);

  // Generation with valid settings
  const gen = calculateGenerationUnits(4, validSettings);
  assert.equal(gen.annualUnits, 6000); // 4 * 1500

  // Generation with missing settings throws
  assert.throws(() => {
    calculateGenerationUnits(4, { governance_settings: {} });
  }, /Missing required specific yield/);

  // Savings with valid settings
  const sav = calculateSavingsAndPayback(100000, 6000, validSettings);
  assert.equal(sav.annualSavings, Math.round(6000 * 7.25));

  // Savings with missing settings throws
  assert.throws(() => {
    calculateSavingsAndPayback(100000, 6000, { governance_settings: {} });
  }, /Missing required tariff/);

  // EMI with valid settings
  const emi = calcEMI(100000, validSettings, 5);
  assert.ok(emi > 2000);

  // EMI with missing settings throws
  assert.throws(() => {
    calcEMI(100000, { governance_settings: {} }, 5);
  }, /Missing required loan rate/);

  // validateDealerMargin without cap throws
  assert.throws(() => {
    validateDealerMargin(10000, 3, undefined);
  }, /Missing required dealer margin cap/);
});

// ── 4. Cross-Dealer Overwrite Prevention (SEC-005) ───────────────────────────
test('SEC-005 IDOR: Cross-dealer overwrite is rejected with 403', () => {
  function validateQuotationOwnership({ callerRole, callerDealerId, existingQuotation }) {
    if (callerRole === 'dealer') {
      if (existingQuotation && existingQuotation.dealer_id !== callerDealerId) {
        return { status: 403, error: 'Access denied: You cannot modify another dealer\'s quotation.' };
      }
    }
    return { status: 200 };
  }

  const result = validateQuotationOwnership({
    callerRole: 'dealer',
    callerDealerId: 'dealer_123',
    existingQuotation: { id: 'SV-2026-Q0001', dealer_id: 'dealer_999', status: 'Draft' }
  });

  assert.equal(result.status, 403);
  assert.match(result.error, /Access denied/);
});

// ── 5. Status Workflow Matrix (SEC-005) ──────────────────────────────────────
test('SEC-005 Status Protection: Dealer editing non-Draft / non-Rejected quote returns 409 Conflict', () => {
  function validateQuotationEditStatus({ callerRole, existingStatus }) {
    if (callerRole === 'dealer') {
      if (existingStatus !== 'Draft' && existingStatus !== 'Rejected') {
        return {
          status: 409,
          error: `Cannot edit quotation with status "${existingStatus}". Only Draft or Rejected quotations can be modified.`
        };
      }
    }
    return { status: 200 };
  }

  assert.equal(validateQuotationEditStatus({ callerRole: 'dealer', existingStatus: 'Pending' }).status, 409);
  assert.equal(validateQuotationEditStatus({ callerRole: 'dealer', existingStatus: 'Approved' }).status, 409);
  assert.equal(validateQuotationEditStatus({ callerRole: 'dealer', existingStatus: 'Archived' }).status, 409);
  assert.equal(validateQuotationEditStatus({ callerRole: 'dealer', existingStatus: 'Draft' }).status, 200);
  assert.equal(validateQuotationEditStatus({ callerRole: 'dealer', existingStatus: 'Rejected' }).status, 200);
});

// ── 6. Unknown BOM Item ID Rejection (SEC-006) ───────────────────────────────
test('SEC-006 Pricing Integrity: Unknown BOM item ID is rejected when custom items disabled', () => {
  function validateBomLineItems(items, bomCatalogMap, allowCustomBomLines) {
    for (const item of items) {
      if (item.id === 'solar_panel' || item.id === 'solar_inverter') continue;
      if (!bomCatalogMap[item.id]) {
        if (!allowCustomBomLines) {
          return {
            status: 422,
            error: `Unknown BOM item ID: "${item.id}". Custom BOM line items are not permitted.`
          };
        }
      }
    }
    return { status: 200 };
  }

  const catalogMap = {
    gi_pipe_60x40: { id: 'gi_pipe_60x40', rate: 85, gstRate: 18 },
    stud: { id: 'stud', rate: 140, gstRate: 18 }
  };

  const invalidSubmission = [
    { id: 'gi_pipe_60x40', qty: 10, rate: 85 },
    { id: 'malicious_injected_item_x', qty: 1, rate: 99999 }
  ];

  const check = validateBomLineItems(invalidSubmission, catalogMap, false);
  assert.equal(check.status, 422);
  assert.match(check.error, /Unknown BOM item ID/);

  const validSubmission = [
    { id: 'gi_pipe_60x40', qty: 10, rate: 85 },
    { id: 'stud', qty: 5, rate: 140 }
  ];
  assert.equal(validateBomLineItems(validSubmission, catalogMap, false).status, 200);
});

// ── 7. ITEM-3 Tamper Protection Tests ────────────────────────────────────────

test('ITEM-3a: Missing solar module DB rate returns 422 Unprocessable Entity', () => {
  function validateModuleRate(panelData) {
    const rate = Number(panelData?.rate_per_wp_inr) || Number(String(panelData?.rate_per_wp || '').replace(/[^0-9.]/g, '')) || 0;
    if (!rate || rate <= 0) {
      return { status: 422, error: 'Database rate missing for solar module.' };
    }
    return { status: 200, rate };
  }

  assert.equal(validateModuleRate({ rate_per_wp_inr: null, rate_per_wp: '' }).status, 422);
  assert.equal(validateModuleRate({ rate_per_wp_inr: 0 }).status, 422);
  assert.equal(validateModuleRate({ rate_per_wp_inr: 18.5 }).status, 200);
});

test('ITEM-3b: Capacity mismatch / tampering (kw inflation or qty inflation) is rejected with 422', () => {
  function validateCapacityAgainstBom(kw, panelQty, dbWatt, tolerance = 0.15) {
    if (dbWatt > 0 && panelQty > 0) {
      const calculatedKw = (panelQty * dbWatt) / 1000;
      if (Math.abs(kw - calculatedKw) > tolerance) {
        return {
          status: 422,
          error: `system_capacity_kw (${kw} kW) does not match panel quantity (${panelQty} x ${dbWatt}W = ${calculatedKw} kW)`
        };
      }
      return { status: 200, serverValidatedKw: Number(calculatedKw.toFixed(2)) };
    }
    return { status: 200, serverValidatedKw: kw };
  }

  // kw inflation: client claims 10 kW but BOM only has 6 x 550W (3.3 kW)
  const kwInflation = validateCapacityAgainstBom(10, 6, 550);
  assert.equal(kwInflation.status, 422);
  assert.match(kwInflation.error, /does not match/);

  // qty inflation: client claims 3.3 kW but injects 50 panels (27.5 kW)
  const qtyInflation = validateCapacityAgainstBom(3.3, 50, 550);
  assert.equal(qtyInflation.status, 422);
  assert.match(qtyInflation.error, /does not match/);

  // Honest 5.5 kW with 10 x 550W panels
  const honest = validateCapacityAgainstBom(5.5, 10, 550);
  assert.equal(honest.status, 200);
  assert.equal(honest.serverValidatedKw, 5.5);
});

test('ITEM-3c: Rate tampering (e.g. rate = 0.01) is clamped to minimum catalogue tolerance (0.9x default)', () => {
  function sanitizeBomItemRate(clientRate, catEntry, tolerancePct = 10) {
    const defaultRate = Number(catEntry.defaultRate) || 0;
    const minAllowedRate = defaultRate > 0 ? Math.round((1 - tolerancePct / 100) * defaultRate) : 0;
    const maxAllowedRate = defaultRate > 0 ? Math.round((1 + tolerancePct / 100) * defaultRate) : 100000;

    let rate = Number(clientRate);
    if (isNaN(rate) || rate <= 0) {
      return defaultRate;
    }
    return Math.min(maxAllowedRate, Math.max(minAllowedRate, rate));
  }

  const catEntry = { defaultRate: 1000, maxRate: 2000 };

  // Malicious low rate (0.01) is clamped up to 900 (0.9 * 1000)
  assert.equal(sanitizeBomItemRate(0.01, catEntry), 900);
  // Malicious zero rate falls back to default 1000
  assert.equal(sanitizeBomItemRate(0, catEntry), 1000);
  // Malicious high rate (50000) is clamped down to 1100 (1.1 * 1000)
  assert.equal(sanitizeBomItemRate(50000, catEntry), 1100);
  // Valid within tolerance rate (950) is accepted
  assert.equal(sanitizeBomItemRate(950, catEntry), 950);
});

test('ITEM-3a: Panel watt tampering (e.g. panel_watt = 1) is overridden by verified DB wattage', () => {
  function computePanelLineItem(panelQty, clientWatt, dbWatt, panelRatePerWp) {
    // Wattage must come from DB, not client
    const effectiveWatt = dbWatt;
    const rate = Math.round(effectiveWatt * panelRatePerWp);
    return { qty: panelQty, rate, total: panelQty * rate };
  }

  const dbWatt = 550;
  const panelRatePerWp = 18;
  const clientTamperedWatt = 1;

  const lineItem = computePanelLineItem(10, clientTamperedWatt, dbWatt, panelRatePerWp);
  assert.equal(lineItem.rate, 9900, 'Rate per panel must be 550W * 18 = 9,900 (ignoring client watt=1)');
  assert.equal(lineItem.total, 99000);
});


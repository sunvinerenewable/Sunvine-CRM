import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSubsidy,
  calculateGenerationUnits,
  calculateSavingsAndPayback,
  validateDealerMargin,
  calcBOMTotals,
  calcEMI
} from '../../shared/pricing/calculations.js';

// ─────────────────────────────────────────────────────────────────────────────
// PM SURYA GHAR SUBSIDY — Tiered formula (MNRE 2023)
// Rs 30,000/kW for first 2 kW; Rs 18,000/kW for 2–3 kW; cap Rs 78,000
// MANUAL: Re-verify against pmsuryaghar.gov.in before each release
// ─────────────────────────────────────────────────────────────────────────────
test('PM Surya Ghar Subsidy — zero and negative', () => {
  assert.equal(calculateSubsidy(0, 'Residential'), 0);
  assert.equal(calculateSubsidy(-5, 'Residential'), 0);
  assert.equal(calculateSubsidy(null, 'Residential'), 0);
  assert.equal(calculateSubsidy(NaN, 'Residential'), 0);
});

test('PM Surya Ghar Subsidy — Commercial always zero', () => {
  assert.equal(calculateSubsidy(5, 'Commercial'), 0);
  assert.equal(calculateSubsidy(100, 'Commercial'), 0);
  assert.equal(calculateSubsidy(1, 'Commercial'), 0);
});

test('PM Surya Ghar Subsidy — Residential exact tier boundaries', () => {
  // 1 kW: 1 × 30000 = 30000
  assert.equal(calculateSubsidy(1, 'Residential'), 30000);
  // 2 kW: 2 × 30000 = 60000
  assert.equal(calculateSubsidy(2, 'Residential'), 60000);
  // 3 kW: 2×30000 + 1×18000 = 78000 → capped at 78000
  assert.equal(calculateSubsidy(3, 'Residential'), 78000);
  // Above 3 kW → capped at 78000
  assert.equal(calculateSubsidy(5, 'Residential'), 78000);
  assert.equal(calculateSubsidy(10, 'Residential'), 78000);
});

test('PM Surya Ghar Subsidy — Residential fractional capacities', () => {
  // 0.8 kW: 0.8 × 30000 = 24000
  assert.equal(calculateSubsidy(0.8, 'Residential'), 24000);
  // 1.5 kW: 1.5 × 30000 = 45000
  assert.equal(calculateSubsidy(1.5, 'Residential'), 45000);
  // 1.8 kW: 1.8 × 30000 = 54000
  assert.equal(calculateSubsidy(1.8, 'Residential'), 54000);
  // 2.5 kW: 2×30000 + 0.5×18000 = 60000 + 9000 = 69000
  assert.equal(calculateSubsidy(2.5, 'Residential'), 69000);
  // 2.8 kW: 2×30000 + 0.8×18000 = 60000 + 14400 = 74400
  assert.equal(calculateSubsidy(2.8, 'Residential'), 74400);
});

// ─────────────────────────────────────────────────────────────────────────────
// SOLAR GENERATION
// ─────────────────────────────────────────────────────────────────────────────
test('Solar Generation Units', () => {
  const gen3kw = calculateGenerationUnits(3.3);
  assert.equal(gen3kw.annualUnits, Math.round(3.3 * 1440));
  assert.equal(gen3kw.monthlyUnits, Math.round(gen3kw.annualUnits / 12));
  assert.ok(gen3kw.dailyUnits > 0);

  const genZero = calculateGenerationUnits(0);
  assert.equal(genZero.annualUnits, 0);
  assert.equal(genZero.monthlyUnits, 0);
  assert.equal(genZero.dailyUnits, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SAVINGS & PAYBACK
// ─────────────────────────────────────────────────────────────────────────────
test('Savings and Payback Calculation', () => {
  const annualUnits = Math.round(3.3 * 1440); // 4752
  const result = calculateSavingsAndPayback(140000, annualUnits, 6.67);
  assert.equal(result.annualSavings, Math.round(annualUnits * 6.67));
  assert.equal(result.monthlySavings, Math.round(result.annualSavings / 12));
  assert.ok(result.paybackPercent > 0 && result.paybackPercent <= 100);

  const zero = calculateSavingsAndPayback(0, 0);
  assert.equal(zero.annualSavings, 0);
  assert.equal(zero.paybackYears, '0.0');
});

// ─────────────────────────────────────────────────────────────────────────────
// DEALER MARGIN VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
test('Dealer Margin Tier Compliance', () => {
  // 15000 / 3.3 = 4545 <= 6000 → not exceeded
  const valid = validateDealerMargin(15000, 3.3, 6000);
  assert.equal(valid.isMarginExceeded, false);
  assert.equal(valid.marginPerKw, 4545);

  // 25000 / 3.3 = 7576 > 6000 → exceeded; clamped to 6000 * 3.3 = 19800
  const exceeded = validateDealerMargin(25000, 3.3, 6000);
  assert.equal(exceeded.isMarginExceeded, true);
  assert.equal(exceeded.marginPerKw, 7576);
  assert.equal(exceeded.effectiveMargin, Math.round(6000 * 3.3));

  // Zero kW edge case
  const zeroKw = validateDealerMargin(5000, 0, 6000);
  assert.equal(zeroKw.marginPerKw, 0);
  assert.equal(zeroKw.isMarginExceeded, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// BOM GST AGGREGATION — mixed 5/18/0 rates, paise rounding
// ─────────────────────────────────────────────────────────────────────────────
test('BOM GST Aggregation — mixed rates intra-state (CGST+SGST)', () => {
  const items = [
    { id: 'panel', qty: 6, rate: 10000, gstRate: 5 },   // 60000 base, 3000 GST, total 63000
    { id: 'structure', qty: 4, rate: 1500, gstRate: 18 }, // 6000 base, 1080 GST, total 7080
    { id: 'freight', qty: 1, rate: 1000, gstRate: 0 }    // 1000 base, 0 GST, total 1000
  ];
  const totals = calcBOMTotals(items, false);
  assert.equal(totals.subtotal5Base, 60000);
  assert.equal(totals.gst5Total, 3000);
  assert.equal(totals.subtotal18Base, 6000);
  assert.equal(totals.gst18Total, 1080);
  assert.equal(totals.subtotal0Base, 1000);
  assert.equal(totals.totalGstAmount, 4080);
  assert.equal(totals.grossTurnkeyCost, 71080); // 63000 + 7080 + 1000
  // CGST = SGST = half of each GST amount
  assert.equal(totals.cgstTotal, Math.round(4080 / 2));
  assert.equal(totals.igstTotal, 0);
});

test('BOM GST Aggregation — inter-state (IGST)', () => {
  const items = [
    { id: 'panel', qty: 1, rate: 50000, gstRate: 5 }
  ];
  const totals = calcBOMTotals(items, true); // isInterState = true
  assert.equal(totals.igstTotal, 2500);
  assert.equal(totals.cgstTotal, 0);
  assert.equal(totals.sgstTotal, 0);
});

test('BOM GST — paise rounding on 22-item BOM does not drift by more than Rs 2', () => {
  // Construct 22 items with fractional paise potential
  const items = Array.from({ length: 22 }, (_, i) => ({
    id: `item_${i}`,
    qty: 3,
    rate: 33.33, // fractional INR
    gstRate: i % 2 === 0 ? 18 : 5
  }));
  const totals = calcBOMTotals(items);
  // Verify gross = sum of individual totalWithGst (no compound drift)
  const manualSum = totals.calculatedItems.reduce((s, it) => s + it.totalWithGst, 0);
  assert.equal(totals.grossTurnkeyCost, manualSum);
});

// ─────────────────────────────────────────────────────────────────────────────
// EMI CALCULATION
// ─────────────────────────────────────────────────────────────────────────────
test('EMI Calculation — standard solar loan', () => {
  // P=100000, r=8.5%pa, n=5yr → ~2051/month
  const emi = calcEMI(100000, 8.5, 5);
  assert.ok(emi > 2000 && emi < 2200, `EMI ${emi} outside expected range 2000-2200`);

  // Zero principal → 0 EMI
  assert.equal(calcEMI(0, 8.5, 5), 0);
  assert.equal(calcEMI(-100, 8.5, 5), 0);
});

/**
 * Sunvine Solar — Shared Pricing & Financial Calculation Engine
 * Single source of truth for ALL money math.
 * Importable by both the React app (src/) AND /api handlers.
 *
 * Rules:
 *  - All intermediate values are in integer paise (1 INR = 100 paise)
 *  - Math.round() applied only at the final output boundary
 *  - No hardcoded prices — rates must be passed in from the caller (DB-sourced)
 *  - Constants that come from system_settings in DB are noted with DEFAULT_ prefix
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. SUBSIDY — PM Surya Ghar Residential (MNRE, effective 2023 revision)
//    Tier 1: Rs 30,000/kW for first 2 kW
//    Tier 2: Rs 18,000/kW for additional capacity up to 3 kW
//    Cap: Rs 78,000 total (≥3 kW)
//    Commercial / Industrial: Rs 0
//
//    MANUAL: Verify current rates at https://pmsuryaghar.gov.in before each release.
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_SUBSIDY_SLAB_1_RATE = 30000; // Rs/kW for ≤2 kW
export const DEFAULT_SUBSIDY_SLAB_2_RATE = 18000; // Rs/kW for 2–3 kW
export const DEFAULT_SUBSIDY_CAP = 78000;          // Rs maximum

/**
 * @param {number} kw  - System capacity in kW
 * @param {string} projectType - 'Residential' | 'Commercial'
 * @param {number} [cap] - Override from system_settings; default 78000
 * @param {number} [slab1Rate] - Rs/kW for ≤2 kW; default 30000
 * @param {number} [slab2Rate] - Rs/kW for 2–3 kW; default 18000
 * @returns {number} subsidy amount in INR (integer)
 */
export function calculateSubsidy(
  kw,
  projectType = 'Residential',
  cap = DEFAULT_SUBSIDY_CAP,
  slab1Rate = DEFAULT_SUBSIDY_SLAB_1_RATE,
  slab2Rate = DEFAULT_SUBSIDY_SLAB_2_RATE
) {
  const capacity = Number(kw);
  if (!Number.isFinite(capacity) || capacity <= 0 || projectType === 'Commercial') return 0;
  // Tier 1: first 2 kW @ slab1Rate/kW
  const tier1Paise = Math.min(capacity, 2) * slab1Rate * 100;
  // Tier 2: capacity between 2 and 3 kW @ slab2Rate/kW
  const tier2Paise = Math.max(0, Math.min(capacity, 3) - 2) * slab2Rate * 100;
  return Math.min(Math.round((tier1Paise + tier2Paise) / 100), cap);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PANEL COST
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {number} wattage     - Panel wattage (Wp)
 * @param {number} quantity    - Panel count
 * @param {number} ratePerWp   - Rate in Rs/Wp (numeric, from DB solar_modules.rate_per_wp_inr)
 * @returns {number} base panel cost in INR (integer, ex-GST)
 */
export function calcPanelCost(wattage, quantity, ratePerWp) {
  const paise = Math.round(Number(wattage) * Number(ratePerWp) * 100) * Number(quantity);
  return Math.round(paise / 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. INVERTER COST
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {number} unitPrice   - Price per inverter in INR (from DB solar_inverters.base_price_inr)
 * @param {number} quantity    - Inverter count
 * @returns {number} base inverter cost in INR (integer, ex-GST)
 */
export function calcInverterCost(unitPrice, quantity) {
  return Math.round(Number(unitPrice) * Number(quantity));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GST CALCULATION  (per item)
//    GST rates are stored per BOM item in DB (5 / 18 / 0)
//    CGST + SGST for intra-state (Gujarat → Gujarat)
//    IGST for inter-state
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {number} baseAmount   - ex-GST amount in INR
 * @param {number} gstRate      - 0, 5, or 18
 * @param {boolean} isInterState - true → IGST; false → CGST+SGST
 * @returns {{ gstAmount, cgst, sgst, igst, totalWithGst }}
 */
export function calcItemGST(baseAmount, gstRate, isInterState = false) {
  const base = Math.round(Number(baseAmount));
  const rate = Number(gstRate) || 0;
  const gstAmountPaise = base * rate; // already in paise-like fraction; round at end
  const gstAmount = Math.round(gstAmountPaise / 100);
  const half = Math.round(gstAmount / 2);
  return {
    gstAmount,
    cgst: isInterState ? 0 : half,
    sgst: isInterState ? 0 : gstAmount - half,
    igst: isInterState ? gstAmount : 0,
    totalWithGst: base + gstAmount
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BOM TOTALS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Aggregate BOM line items into totals.
 * Each item must have: { qty, rate, gstRate }
 * @param {Array} items
 * @param {boolean} isInterState
 * @returns totals object
 */
export function calcBOMTotals(items = [], isInterState = false) {
  let subtotal5Base = 0;
  let subtotal18Base = 0;
  let subtotal0Base = 0;
  let gst5Total = 0;
  let gst18Total = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let grossTurnkeyCost = 0;

  const calculatedItems = (items || []).map((item, idx) => {
    const qty = Math.max(0, Number(item.qty) || 0);
    const rate = Math.max(0, Number(item.rate) || 0);
    const gstRate = Number(item.gstRate != null ? item.gstRate : 18);
    // Compute base in paise for precision, then round to INR once
    const basePaise = qty * rate * 100;
    const baseAmount = Math.round(basePaise / 100);
    const gstInfo = calcItemGST(baseAmount, gstRate, isInterState);

    if (gstRate === 5) {
      subtotal5Base += baseAmount;
      gst5Total += gstInfo.gstAmount;
    } else if (gstRate === 18) {
      subtotal18Base += baseAmount;
      gst18Total += gstInfo.gstAmount;
    } else {
      subtotal0Base += baseAmount;
    }
    cgstTotal += gstInfo.cgst;
    sgstTotal += gstInfo.sgst;
    igstTotal += gstInfo.igst;
    grossTurnkeyCost += gstInfo.totalWithGst;

    return {
      ...item,
      srNo: idx + 1,
      qty,
      rate,
      gstRate,
      baseAmount,
      gstAmount: gstInfo.gstAmount,
      cgst: gstInfo.cgst,
      sgst: gstInfo.sgst,
      igst: gstInfo.igst,
      totalWithGst: gstInfo.totalWithGst
    };
  });

  const totalGstAmount = gst5Total + gst18Total;
  const totalTaxableBase = subtotal5Base + subtotal18Base + subtotal0Base;

  return {
    calculatedItems,
    subtotal5Base,
    subtotal18Base,
    subtotal0Base,
    gst5Total,
    gst18Total,
    cgstTotal,
    sgstTotal,
    igstTotal,
    totalTaxableBase,
    totalGstAmount,
    grossTurnkeyCost
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DEALER MARGIN VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {number} marginINR      - Requested margin in INR
 * @param {number} capacityKw     - System capacity
 * @param {number} maxCapPerKw    - Tier cap (from DB dealer_custom_pricing)
 * @returns {{ marginPerKw, isMarginExceeded, effectiveMargin }}
 */
export function validateDealerMargin(marginINR, capacityKw, maxCapPerKw = 6000) {
  const kw = Number(capacityKw);
  if (!kw || kw <= 0) return { marginPerKw: 0, isMarginExceeded: false, effectiveMargin: 0 };
  const marginPerKw = Math.round(Number(marginINR || 0) / kw);
  const isMarginExceeded = marginPerKw > maxCapPerKw;
  const effectiveMargin = isMarginExceeded
    ? Math.round(maxCapPerKw * kw)
    : Math.round(Number(marginINR || 0));
  return { marginPerKw, isMarginExceeded, effectiveMargin };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. FINAL TOTALS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Compute the complete quotation financial summary.
 * @param {object} p
 * @param {number} p.grossTurnkeyCost  - BOM total incl. GST
 * @param {number} p.dealerMarginINR   - Capped margin (use effectiveMargin from validateDealerMargin)
 * @param {number} p.discountAmount    - Negotiated discount (0 if none)
 * @param {number} p.subsidyAmount     - From calculateSubsidy
 * @returns {{ totalAmount, netPayable }}
 */
export function calcFinalTotals({ grossTurnkeyCost, dealerMarginINR, discountAmount = 0, subsidyAmount = 0 }) {
  const totalAmount = Math.max(0, Math.round(grossTurnkeyCost + dealerMarginINR - discountAmount));
  const netPayable = Math.max(0, Math.round(totalAmount - subsidyAmount));
  return { totalAmount, netPayable };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. SOLAR GENERATION
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_SPECIFIC_YIELD = 1440; // kWh/kW/year (Gujarat benchmark)
export const DEFAULT_TARIFF_PER_UNIT = 6.67; // Rs/kWh

/**
 * @param {number} kw
 * @param {number} [specificYield]
 */
export function calculateGenerationUnits(kw, specificYield = DEFAULT_SPECIFIC_YIELD) {
  const capacity = Number(kw);
  if (!capacity || capacity <= 0) return { annualUnits: 0, monthlyUnits: 0, dailyUnits: 0 };
  const annualUnits = Math.round(capacity * specificYield);
  const monthlyUnits = Math.round(annualUnits / 12);
  const dailyUnits = Number((annualUnits / 365).toFixed(1));
  return { annualUnits, monthlyUnits, dailyUnits };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. SAVINGS & PAYBACK
// ─────────────────────────────────────────────────────────────────────────────
export function calculateSavingsAndPayback(netPayable, annualUnits, tariff = DEFAULT_TARIFF_PER_UNIT) {
  if (!netPayable || netPayable <= 0 || !annualUnits || annualUnits <= 0) {
    return { annualSavings: 0, monthlySavings: 0, paybackYears: '0.0', paybackPercent: 0 };
  }
  const annualSavings = Math.round(annualUnits * Number(tariff));
  const monthlySavings = Math.round(annualSavings / 12);
  const paybackYears = (netPayable / annualSavings).toFixed(1);
  const paybackPercent = Math.min(100, Math.round((parseFloat(paybackYears) / 10) * 100));
  return { annualSavings, monthlySavings, paybackYears, paybackPercent };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. EMI CALCULATION
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_SOLAR_LOAN_RATE_PA = 8.5; // % per annum

/**
 * @param {number} principal     - Loan amount in INR
 * @param {number} annualRatePct - Annual interest rate %
 * @param {number} tenureYears   - Loan tenure in years
 * @returns {number} Monthly EMI in INR (integer)
 */
export function calcEMI(principal, annualRatePct = DEFAULT_SOLAR_LOAN_RATE_PA, tenureYears = 5) {
  const P = Math.max(0, Number(principal));
  if (P <= 0) return 0;
  const r = Number(annualRatePct) / (12 * 100);
  const n = Number(tenureYears) * 12;
  if (r === 0) return Math.round(P / n);
  const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi);
}

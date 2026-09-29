/**
 * Sunvine Renewable Energy - Solar Engineering & Financial Calculation Engine
 * Pure, side-effect-free calculation functions for PM Surya Ghar, generation, and commercial formulas.
 */

/**
 * Calculate PM Surya Ghar Central DBT Subsidy (Residential)
 * 1 kW -> ₹30,000 (Standard) / ₹33,000
 * 2 kW -> ₹60,000 (Standard) / ₹66,000
 * >= 3 kW -> ₹78,000 (Cap)
 * Commercial -> ₹0
 */
export function calculateSubsidy(capacityKw, projectType = 'Residential', subsidyCap = 78000) {
  if (!capacityKw || capacityKw <= 0 || projectType === 'Commercial') {
    return 0;
  }
  const cap = Number(capacityKw);
  if (cap <= 1) return Math.min(30000, subsidyCap);
  if (cap <= 2) return Math.min(60000, subsidyCap);
  return subsidyCap;
}

/**
 * Calculate Annual & Monthly Solar Generation (Units / kWh)
 * Gujarat benchmark: ~1440 kWh per kW annually (~4 units / kW / day)
 */
export function calculateGenerationUnits(capacityKw, specificYield = 1440) {
  if (!capacityKw || capacityKw <= 0) {
    return { annualUnits: 0, monthlyUnits: 0, dailyUnits: 0 };
  }
  const annualUnits = Math.round(Number(capacityKw) * specificYield);
  const monthlyUnits = Math.round(annualUnits / 12);
  const dailyUnits = Number((annualUnits / 365).toFixed(1));
  return { annualUnits, monthlyUnits, dailyUnits };
}

/**
 * Calculate Financial Savings & Simple Payback Period
 */
export function calculateSavingsAndPayback(netPayable, annualUnits, unitTariff = 6.67) {
  if (!netPayable || netPayable <= 0 || !annualUnits || annualUnits <= 0) {
    return {
      annualSavings: 0,
      monthlySavings: 0,
      paybackYears: '0.0',
      paybackPercent: 0
    };
  }
  const annualSavings = Math.round(annualUnits * unitTariff);
  const monthlySavings = Math.round(annualSavings / 12);
  const paybackYears = annualSavings > 0 ? (netPayable / annualSavings).toFixed(1) : '0.0';
  const paybackPercent = Math.min(100, Math.round((parseFloat(paybackYears) / 10) * 100));

  return {
    annualSavings,
    monthlySavings,
    paybackYears,
    paybackPercent
  };
}

/**
 * Calculate Margin per kW and check tier compliance
 */
export function validateDealerMargin(marginINR, capacityKw, maxMarginCapPerKw = 6000) {
  if (!capacityKw || capacityKw <= 0) {
    return { marginPerKw: 0, isMarginExceeded: false };
  }
  const marginPerKw = Math.round(Number(marginINR || 0) / Number(capacityKw));
  const isMarginExceeded = marginPerKw > maxMarginCapPerKw;
  return { marginPerKw, isMarginExceeded };
}

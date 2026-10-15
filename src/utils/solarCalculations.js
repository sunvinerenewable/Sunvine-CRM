/**
 * Sunvine Renewable Energy - Solar Engineering & Financial Calculation Engine
 * Re-exports from the shared module so existing import paths keep working.
 * SINGLE SOURCE OF TRUTH: src/shared/pricing/calculations.js
 *
 * MANUAL: Verify PM Surya Ghar subsidy rates at https://pmsuryaghar.gov.in before each release.
 */
export {
  calculateSubsidy,
  calculateGenerationUnits,
  calculateSavingsAndPayback,
  validateDealerMargin,
  calcBOMTotals,
  calcFinalTotals,
  calcEMI,
  DEFAULT_SUBSIDY_CAP,
  DEFAULT_SUBSIDY_SLAB_1_RATE,
  DEFAULT_SUBSIDY_SLAB_2_RATE,
  DEFAULT_SPECIFIC_YIELD,
  DEFAULT_TARIFF_PER_UNIT,
  DEFAULT_SOLAR_LOAN_RATE_PA
} from '../shared/pricing/calculations.js';


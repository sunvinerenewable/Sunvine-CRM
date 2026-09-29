import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSubsidy,
  calculateGenerationUnits,
  calculateSavingsAndPayback,
  validateDealerMargin
} from '../solarCalculations.js';

test('PM Surya Ghar Subsidy Calculations', () => {
  // Residential 1 kW
  assert.equal(calculateSubsidy(1.0, 'Residential'), 30000);
  assert.equal(calculateSubsidy(0.8, 'Residential'), 30000);

  // Residential 2 kW
  assert.equal(calculateSubsidy(2.0, 'Residential'), 60000);
  assert.equal(calculateSubsidy(1.8, 'Residential'), 60000);

  // Residential 3 kW and higher
  assert.equal(calculateSubsidy(3.0, 'Residential'), 78000);
  assert.equal(calculateSubsidy(5.0, 'Residential'), 78000);
  assert.equal(calculateSubsidy(10.0, 'Residential'), 78000);

  // Commercial / Industrial (Zero Central Subsidy)
  assert.equal(calculateSubsidy(5.0, 'Commercial'), 0);
  assert.equal(calculateSubsidy(100.0, 'Commercial'), 0);

  // Edge cases
  assert.equal(calculateSubsidy(0, 'Residential'), 0);
  assert.equal(calculateSubsidy(-5, 'Residential'), 0);
  assert.equal(calculateSubsidy(null, 'Residential'), 0);
});

test('Solar Generation Units Engine', () => {
  const gen3kw = calculateGenerationUnits(3.3);
  assert.equal(gen3kw.annualUnits, Math.round(3.3 * 1440)); // 4752
  assert.equal(gen3kw.monthlyUnits, Math.round(4752 / 12)); // 396
  assert.ok(gen3kw.dailyUnits > 0);

  // Zero capacity
  const genZero = calculateGenerationUnits(0);
  assert.equal(genZero.annualUnits, 0);
  assert.equal(genZero.monthlyUnits, 0);
});

test('Savings and Payback Calculation', () => {
  const annualUnits = 4752; // 3.3 kW
  const netPayable = 140000;
  const result = calculateSavingsAndPayback(netPayable, annualUnits, 6.67);

  assert.equal(result.annualSavings, Math.round(4752 * 6.67)); // 31696
  assert.equal(result.monthlySavings, Math.round(31696 / 12)); // 2641
  assert.equal(result.paybackYears, (140000 / 31696).toFixed(1)); // 4.4
  assert.ok(result.paybackPercent > 0 && result.paybackPercent <= 100);

  // Zero values
  const zeroResult = calculateSavingsAndPayback(0, 0);
  assert.equal(zeroResult.annualSavings, 0);
  assert.equal(zeroResult.paybackYears, '0.0');
});

test('Dealer Margin Tier Compliance', () => {
  // Margin within tier cap
  const valid = validateDealerMargin(15000, 3.3, 6000); // 15000 / 3.3 = 4545 <= 6000
  assert.equal(valid.isMarginExceeded, false);
  assert.equal(valid.marginPerKw, 4545);

  // Margin exceeding tier cap
  const exceeded = validateDealerMargin(25000, 3.3, 6000); // 25000 / 3.3 = 7576 > 6000
  assert.equal(exceeded.isMarginExceeded, true);
  assert.equal(exceeded.marginPerKw, 7576);
});

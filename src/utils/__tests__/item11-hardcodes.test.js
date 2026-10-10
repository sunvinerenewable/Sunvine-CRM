/**
 * item11-hardcodes.test.js — Verification tests for remaining hardcode removal (Round 4 Item 11)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('ITEM-11: Verified target files have zero illegal business logic fallbacks', () => {
  const targetFiles = [
    'src/components/AdminPortal/AdminDashboard.jsx',
    'src/components/AdminPortal/AdminSettings.jsx',
    'src/components/AdminPortal/AllQuotations.jsx',
    'src/components/AdminPortal/ReportsAnalytics.jsx',
    'src/components/DealerPortal/CreateQuotation.jsx',
    'src/components/DealerPortal/PDFTemplate.jsx',
    'src/components/StaffPortal/StaffDashboard.jsx',
    'src/services/dealerService.js',
    'src/services/pricingService.js',
    'src/services/settingsService.js'
  ];

  for (const relPath of targetFiles) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    // Assert no fallback to 1440 yield in expressions
    assert.equal(
      /\|\|\s*1440\b/.test(content),
      false,
      `${relPath} must not contain "|| 1440" fallback`
    );

    // Assert no fallback to 78000 subsidy in expressions
    assert.equal(
      /\|\|\s*78000\b/.test(content),
      false,
      `${relPath} must not contain "|| 78000" fallback`
    );

    // Assert no fallback to 6000 margin cap in expressions
    assert.equal(
      /\|\|\s*6000\b/.test(content),
      false,
      `${relPath} must not contain "|| 6000" fallback`
    );
  }
});

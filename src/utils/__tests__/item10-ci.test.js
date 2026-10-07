/**
 * item10-ci.test.js — Verification tests for Round 4 Item 10
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('ITEM-10: .github/workflows/ci.yml uses standalone gitleaks binary step', () => {
  const ciPath = path.resolve(process.cwd(), '.github/workflows/ci.yml');
  const ciContent = fs.readFileSync(ciPath, 'utf8');

  assert.equal(
    ciContent.includes('uses: gitleaks/gitleaks-action'),
    false,
    'CI workflow must not use gitleaks-action to prevent org license failures'
  );
  assert.match(ciContent, /gitleaks detect/i, 'CI workflow must run gitleaks detect binary command');
});

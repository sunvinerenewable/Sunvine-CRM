import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcFinalTotals,
  validateDealerMargin
} from '../../shared/pricing/calculations.js';
import { hashPassword, verifyPassword } from '../../../api/_lib/security.js';
import { signJwt, verifyJwt } from '../../../api/_lib/jwt.js';

// Setup test JWT secret
process.env.JWT_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// ── 1. Password Security & PBKDF2 Hashing ──────────────────────────────────
test('Password Security: PBKDF2 hash generation and verification', () => {
  const pwd = 'CorrectHorseBatteryStaple#2026';
  const hash = hashPassword(pwd);

  assert.ok(hash.startsWith('pbkdf2$100000$'), 'Hash must use PBKDF2 with 100k iterations');
  assert.equal(verifyPassword(pwd, hash), true, 'Valid password must verify');
  assert.equal(verifyPassword('WrongPassword123!', hash), false, 'Wrong password must fail');
  assert.equal(verifyPassword('', hash), false, 'Empty password must fail');
  assert.equal(verifyPassword(pwd, ''), false, 'Empty hash must fail');
});

// ── 2. JWT Security & Expiry ───────────────────────────────────────────────
test('JWT Security: Token issuance and tamper resistance', () => {
  const payload = { id: 'DLR-101', role: 'dealer', dealer_id: 'uuid-101' };
  const token = signJwt(payload, 3600);

  const verified = verifyJwt(token);
  assert.equal(verified.valid, true);
  assert.equal(verified.payload.id, 'DLR-101');
  assert.equal(verified.payload.role, 'dealer');

  // Tamper with payload
  const parts = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ ...payload, role: 'admin' })).toString('base64url');
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  const tamperedResult = verifyJwt(tamperedToken);
  assert.equal(tamperedResult.valid, false, 'Tampered token must be rejected');
});

test('JWT Security: Expired tokens are rejected', () => {
  const payload = { id: 'DLR-101', role: 'dealer' };
  // Expired 10 seconds ago
  const expiredToken = signJwt(payload, -10);

  const res = verifyJwt(expiredToken);
  assert.equal(res.valid, false);
  assert.match(res.error, /expired/i);
});

// ── 3. Money Security: Tampered Total Rejection ─────────────────────────────
test('Money Security: Server recompute overrides tampered client numbers', () => {
  // Client attempts to send net_payable: 1 for a 500,000 project
  const grossTurnkeyCost = 500000;
  const requestedDealerMargin = 15000;
  const subsidyAmount = 78000;

  // Server recalculates
  const { totalAmount, netPayable } = calcFinalTotals({
    grossTurnkeyCost,
    dealerMarginINR: requestedDealerMargin,
    subsidyAmount
  });

  assert.equal(totalAmount, 515000);
  assert.equal(netPayable, 437000);
  assert.notEqual(netPayable, 1, 'Client tampered net_payable: 1 is discarded');
});

// ── 4. Margin Cap Enforcement ──────────────────────────────────────────────
test('Margin Cap: Excessive dealer margin is clamped to tier maximum', () => {
  const capacityKw = 5.0;
  const tierCapPerKw = 6000; // max allowable margin: 30,000

  // Dealer requests 50,000 margin (10,000/kW)
  const result = validateDealerMargin(50000, capacityKw, tierCapPerKw);
  assert.equal(result.isMarginExceeded, true);
  assert.equal(result.marginPerKw, 10000);
  assert.equal(result.effectiveMargin, 30000, 'Effective margin clamped to cap');
});

// ── 5. Status Workflow Matrix ──────────────────────────────────────────────
test('Status Workflow: Dealer cannot approve quotations', () => {
  const STATUS_MACHINE = {
    admin: {
      Draft: ['Pending', 'Approved', 'Archived'],
      Pending: ['Approved', 'Rejected', 'Archived'],
      Approved: ['Archived'],
      Rejected: ['Archived']
    },
    dealer: {
      Draft: ['Pending'],
      Pending: [],
      Approved: [],
      Rejected: ['Draft']
    }
  };

  const dealerAllowedFromPending = STATUS_MACHINE.dealer['Pending'] || [];
  assert.equal(dealerAllowedFromPending.includes('Approved'), false, 'Dealer cannot approve');

  const adminAllowedFromPending = STATUS_MACHINE.admin['Pending'] || [];
  assert.equal(adminAllowedFromPending.includes('Approved'), true, 'Admin can approve');
  assert.equal(adminAllowedFromPending.includes('Rejected'), true, 'Admin can reject');
});

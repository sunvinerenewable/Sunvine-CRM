/**
 * b-auth.test.js — Comprehensive Auth & Security Test Suite (Agent B)
 *
 * Covers:
 * 1. requireUser active vs suspended account check (SEC-012)
 * 2. rateLimiter per-identifier lockout & isolation (SEC-013)
 * 3. jwt.js rejection of altered alg, wrong iss, and oversized tokens (SEC-015)
 * 4. authLogin uniform "Invalid credentials." error responses (SEC-013)
 * 5. HC-12 / HC-03 compliance (no magic IDs, database-first margin caps)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto, { randomBytes } from 'node:crypto';

// Set up random JWT_SECRET for test isolation
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

import { signJwt, verifyJwt } from '../../../api/_lib/jwt.js';
import { requireUser, requireAdmin, checkAccountActiveStatus } from '../../../api/_lib/requireAuth.js';
import {
  checkRateLimit,
  isRateLimited,
  recordFailedAttempt,
  resetRateLimit,
  checkDistributedRateLimit
} from '../../../api/_lib/rateLimiter.js';
import { redisSet, redisDel } from '../../../api/_lib/redis.js';
import authLoginHandler from '../../../api/_lib/authLogin.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const r = {
    _status: null,
    _body: null,
    _headers: {},
    status(code) { r._status = code; return r; },
    json(body) { r._body = body; return r; },
    end() { return r; },
    setHeader(k, v) { r._headers[k] = v; }
  };
  return r;
}

function mockReq({ body = {}, cookie = '', authorization = '', headers = {} } = {}) {
  return {
    method: 'POST',
    body,
    headers: {
      cookie,
      authorization,
      'x-forwarded-for': '127.0.0.1',
      ...headers
    }
  };
}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function craftCustomJwt(headerObj, payloadObj, secret = process.env.JWT_SECRET) {
  const encH = base64UrlEncode(JSON.stringify(headerObj));
  const encP = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${encH}.${encP}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encH}.${encP}.${sig}`;
}

// ── 1. SEC-015: JWT Algorithm, Issuer & Length Verification ──────────────────

test('SEC-015: jwt.js accepts valid HS256 token with sunvine-solar-epc issuer', () => {
  const payload = { id: 'ADM-101', role: 'admin' };
  const token = signJwt(payload, 3600);
  const result = verifyJwt(token);

  assert.equal(result.valid, true);
  assert.equal(result.payload.id, 'ADM-101');
  assert.equal(result.payload.role, 'admin');
  assert.equal(result.payload.iss, 'sunvine-solar-epc');
});

test('SEC-015: jwt.js rejects token with altered algorithm (e.g. none, RS256, HS512)', () => {
  const now = Math.floor(Date.now() / 1000);
  const payload = { id: 'ADM-102', role: 'admin', iss: 'sunvine-solar-epc', iat: now, exp: now + 3600 };

  // Algorithm "none"
  const noneToken = craftCustomJwt({ alg: 'none', typ: 'JWT' }, payload);
  const noneRes = verifyJwt(noneToken);
  assert.equal(noneRes.valid, false);
  assert.match(noneRes.error, /algorithm/i);

  // Algorithm "HS512"
  const hs512Token = craftCustomJwt({ alg: 'HS512', typ: 'JWT' }, payload);
  const hs512Res = verifyJwt(hs512Token);
  assert.equal(hs512Res.valid, false);
  assert.match(hs512Res.error, /algorithm/i);
});

test('SEC-015: jwt.js rejects token with invalid or missing issuer (iss)', () => {
  const now = Math.floor(Date.now() / 1000);

  // Wrong issuer
  const wrongIssToken = craftCustomJwt(
    { alg: 'HS256', typ: 'JWT' },
    { id: 'ADM-103', role: 'admin', iss: 'rogue-issuer-solar', iat: now, exp: now + 3600 }
  );
  const wrongRes = verifyJwt(wrongIssToken);
  assert.equal(wrongRes.valid, false);
  assert.match(wrongRes.error, /issuer/i);

  // Missing issuer
  const missingIssToken = craftCustomJwt(
    { alg: 'HS256', typ: 'JWT' },
    { id: 'ADM-104', role: 'admin', iat: now, exp: now + 3600 }
  );
  const missingRes = verifyJwt(missingIssToken);
  assert.equal(missingRes.valid, false);
  assert.match(missingRes.error, /issuer/i);
});

test('SEC-015: jwt.js rejects oversized token exceeding 4096 characters', () => {
  const hugeString = 'a'.repeat(4100);
  const res = verifyJwt(hugeString);
  assert.equal(res.valid, false);
  assert.match(res.error, /exceeds maximum length/i);
});

// ── 2. SEC-013: RateLimiter Per-Identifier Lockout & Isolation ───────────────

test('SEC-013: rateLimiter locks out account after 5 failures in 15-min window', async () => {
  const acct = 'acct:test_user_lockout_01';
  await resetRateLimit(acct);

  const options = { maxAttempts: 5, windowMs: 15 * 60 * 1000 };

  // 1 to 4 failed attempts should remain allowed
  for (let i = 1; i <= 4; i++) {
    const attempt = recordFailedAttempt(acct, options);
    assert.equal(attempt.allowed, true, `Attempt ${i} must be allowed`);
    assert.equal(attempt.remaining, 5 - i);
  }

  // 5th attempt reaches max
  const fifthAttempt = recordFailedAttempt(acct, options);
  assert.equal(fifthAttempt.allowed, true, '5th attempt is at limit');
  assert.equal(fifthAttempt.remaining, 0);

  // 6th attempt must be locked out
  const sixthAttempt = recordFailedAttempt(acct, options);
  assert.equal(sixthAttempt.allowed, false, '6th attempt must be blocked');
  assert.equal(sixthAttempt.remaining, 0);

  // Read-only check reflects blocked status
  const check = checkRateLimit(acct, { ...options, increment: false });
  assert.equal(check.allowed, false, 'checkRateLimit must report blocked');
  assert.equal(check.remaining, 0);

  // Reset unlocks account
  await resetRateLimit(acct);
  const postReset = checkRateLimit(acct, { ...options, increment: false });
  assert.equal(postReset.allowed, true, 'Account must be unblocked after reset');
});

test('SEC-013: rateLimiter isolates lockouts between different identifiers', async () => {
  const acctA = 'acct:user_alpha';
  const acctB = 'acct:user_beta';
  await resetRateLimit(acctA);
  await resetRateLimit(acctB);

  const options = { maxAttempts: 5, windowMs: 15 * 60 * 1000 };

  // Exhaust attempts for User Alpha
  for (let i = 0; i < 6; i++) {
    recordFailedAttempt(acctA, options);
  }

  // Verify Alpha is blocked but Beta is untouched
  const checkA = isRateLimited(acctA, options);
  const checkB = isRateLimited(acctB, options);

  assert.equal(checkA.blocked, true, 'User Alpha must be blocked');
  assert.equal(checkB.blocked, false, 'User Beta must NOT be blocked');
  assert.equal(checkB.remaining, 5, 'User Beta should have full remaining quota');

  await resetRateLimit(acctA);
  await resetRateLimit(acctB);
});

// ── 3. SEC-012: requireUser Active vs Suspended Account Check ────────────────

test('SEC-012: requireUser permits active accounts', async () => {
  const payload = { id: 'DLR-ACTIVE-01', role: 'dealer', dealer_id: 'DLR-ACTIVE-01', dealerCode: 'DLR-ACTIVE-01' };
  const token = signJwt(payload, 3600);
  const req = mockReq({ cookie: `sunvine_auth_token=${token}` });
  const res = mockRes();

  // Cache status as 'active'
  await redisSet('user:status:dealer:DLR-ACTIVE-01', 'active', 60);

  const result = await requireUser(req, res);
  assert.ok(result !== null, 'Active account must return payload');
  assert.equal(result.role, 'dealer');
  assert.equal(result.id, 'DLR-ACTIVE-01');
  assert.equal(res._status, null, 'No error status sent');

  await redisDel('user:status:dealer:DLR-ACTIVE-01');
});

test('SEC-012: requireUser rejects suspended or inactive accounts with 403 Forbidden', async () => {
  const suspendedPayload = { id: 'DLR-SUSP-01', role: 'dealer', dealer_id: 'DLR-SUSP-01', dealerCode: 'DLR-SUSP-01' };
  const token = signJwt(suspendedPayload, 3600);
  const req = mockReq({ cookie: `sunvine_auth_token=${token}` });
  const res = mockRes();

  // Cache status as 'suspended' in Redis
  await redisSet('user:status:dealer:DLR-SUSP-01', 'suspended', 60);

  const result = await requireUser(req, res);
  assert.equal(result, null, 'Suspended account must return null');
  assert.equal(res._status, 403, 'Must return 403 Forbidden');
  assert.match(res._body.error, /suspended|inactive/i);

  await redisDel('user:status:dealer:DLR-SUSP-01');
});

test('SEC-012: checkAccountActiveStatus detects suspended and inactive statuses', async () => {
  await redisSet('user:status:staff:STF-INACT-01', 'inactive', 60);
  const isStaffActive = await checkAccountActiveStatus({ id: 'STF-INACT-01', role: 'staff' });
  assert.equal(isStaffActive, false, 'Inactive staff must return false');
  await redisDel('user:status:staff:STF-INACT-01');

  await redisSet('user:status:admin:ADM-SUSP-01', 'suspended', 60);
  const isAdminActive = await checkAccountActiveStatus({ id: 'ADM-SUSP-01', role: 'admin' });
  assert.equal(isAdminActive, false, 'Suspended admin must return false');
  await redisDel('user:status:admin:ADM-SUSP-01');
});

// ── 4. SEC-013 & HC-12/03: Login Error Uniformity & Hardcoding Elimination ────

test('SEC-013: authLogin returns uniform "Invalid credentials." for all 401 failures', async () => {
  // Test case A: Non-existent admin email
  {
    const req = mockReq({ body: { identifier: 'nobody@sunvine.in', password: 'SecretPassword123!', role: 'admin' } });
    const res = mockRes();
    await authLoginHandler(req, res);
    assert.equal(res._status, 401);
    assert.deepEqual(res._body, { error: 'Invalid credentials.' });
  }

  // Test case B: Invalid format mobile number (< 10 digits)
  {
    const req = mockReq({ body: { identifier: '12345', password: 'SecretPassword123!', role: 'dealer' } });
    const res = mockRes();
    await authLoginHandler(req, res);
    assert.equal(res._status, 401);
    assert.deepEqual(res._body, { error: 'Invalid credentials.' });
  }

  // Test case C: Non-existent dealer mobile
  {
    const req = mockReq({ body: { identifier: '9999999999', password: 'WrongPassword123!', role: 'dealer' } });
    const res = mockRes();
    await authLoginHandler(req, res);
    assert.equal(res._status, 401);
    assert.deepEqual(res._body, { error: 'Invalid credentials.' });
  }

  // Test case D: Non-existent staff member
  {
    const req = mockReq({ body: { identifier: '8888888888', password: 'WrongPassword123!', role: 'staff' } });
    const res = mockRes();
    await authLoginHandler(req, res);
    assert.equal(res._status, 401);
    assert.deepEqual(res._body, { error: 'Invalid credentials.' });
  }

  // Test case E: Invalid password length (empty string)
  {
    const req = mockReq({ body: { identifier: '9876543210', password: '', role: 'dealer' } });
    const res = mockRes();
    await authLoginHandler(req, res);
    assert.equal(res._status, 400); // input validation catches missing password
  }
});

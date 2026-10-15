/**
 * authManage.test.js — Tests for T0.2 (SEC-001)
 *
 * Verifies that manage-credentials requires a valid admin JWT.
 * Mocks the DB layer so no real database is needed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// Set a random JWT_SECRET before importing anything that reads it
process.env.JWT_SECRET = randomBytes(48).toString('hex');
// Empty ALLOWED_ORIGINS so no origin is reflected
process.env.ALLOWED_ORIGINS = '';

import { signJwt } from '../../../api/_lib/jwt.js';
import { requireAdmin } from '../../../api/_lib/requireAuth.js';
import { applyCors } from '../../../api/_lib/cors.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Minimal mock of a Vercel/Express-style res object.
 * Records the status code and the JSON body sent.
 */
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

/**
 * Minimal mock req with optional cookie / Authorization header.
 */
function mockReq({ cookie = '', authorization = '', origin = '' } = {}) {
  return {
    headers: {
      cookie,
      authorization,
      origin
    }
  };
}

// ── applyCors tests ─────────────────────────────────────────────────────────

test('applyCors: origin not in list — no Allow-Origin header set', () => {
  process.env.ALLOWED_ORIGINS = 'https://allowed.example.com';
  const req = mockReq({ origin: 'https://evil.example.com' });
  const res = mockRes();
  applyCors(req, res);
  assert.equal(res._headers['Access-Control-Allow-Origin'], undefined,
    'Must not reflect an origin that is not in the allowlist');
});

test('applyCors: origin in list — reflects origin with Vary and Credentials', () => {
  process.env.ALLOWED_ORIGINS = 'https://allowed.example.com';
  const req = mockReq({ origin: 'https://allowed.example.com' });
  const res = mockRes();
  applyCors(req, res);
  assert.equal(res._headers['Access-Control-Allow-Origin'], 'https://allowed.example.com');
  assert.equal(res._headers['Vary'], 'Origin');
  assert.equal(res._headers['Access-Control-Allow-Credentials'], 'true');
});

test('applyCors: empty ALLOWED_ORIGINS — no origin reflected', () => {
  process.env.ALLOWED_ORIGINS = '';
  const req = mockReq({ origin: 'https://attacker.example.com' });
  const res = mockRes();
  applyCors(req, res);
  assert.equal(res._headers['Access-Control-Allow-Origin'], undefined);
});

// ── requireAdmin tests ──────────────────────────────────────────────────────

test('requireAdmin: no token → 401', async () => {
  const req = mockReq();
  const res = mockRes();
  const result = await requireAdmin(req, res);
  assert.equal(result, null, 'Must return null');
  assert.equal(res._status, 401);
});

test('requireAdmin: invalid/garbage token → 401', async () => {
  const req = mockReq({ cookie: 'sunvine_auth_token=not.a.valid.token' });
  const res = mockRes();
  const result = await requireAdmin(req, res);
  assert.equal(result, null);
  assert.equal(res._status, 401);
});

test('requireAdmin: valid dealer token → 403', async () => {
  const token = signJwt({ id: 'dealer-1', role: 'dealer', dealer_id: 'SV-DLR-001' });
  const req = mockReq({ cookie: `sunvine_auth_token=${token}` });
  const res = mockRes();
  const result = await requireAdmin(req, res);
  assert.equal(result, null);
  assert.equal(res._status, 403);
});

test('requireAdmin: valid staff token → 403', async () => {
  const token = signJwt({ id: 'staff-1', role: 'staff' });
  const req = mockReq({ authorization: `Bearer ${token}` });
  const res = mockRes();
  const result = await requireAdmin(req, res);
  assert.equal(result, null);
  assert.equal(res._status, 403);
});

test('requireAdmin: valid admin cookie → returns payload', async () => {
  const token = signJwt({ id: 'admin-1', role: 'admin' });
  const req = mockReq({ cookie: `sunvine_auth_token=${token}` });
  const res = mockRes();
  const result = await requireAdmin(req, res);
  assert.ok(result !== null, 'Must return payload for valid admin token');
  assert.equal(result.role, 'admin');
  assert.equal(result.id, 'admin-1');
});

test('requireAdmin: valid admin Bearer token → returns payload', async () => {
  const token = signJwt({ id: 'admin-2', role: 'admin' });
  const req = mockReq({ authorization: `Bearer ${token}` });
  const res = mockRes();
  const result = await requireAdmin(req, res);
  assert.ok(result !== null);
  assert.equal(result.role, 'admin');
});

test('requireAdmin: expired token → 401', async () => {
  // Sign a token that expired 1 second ago
  const token = signJwt({ id: 'admin-3', role: 'admin' }, -1);
  const req = mockReq({ cookie: `sunvine_auth_token=${token}` });
  const res = mockRes();
  const result = await requireAdmin(req, res);
  assert.equal(result, null);
  assert.equal(res._status, 401);
});

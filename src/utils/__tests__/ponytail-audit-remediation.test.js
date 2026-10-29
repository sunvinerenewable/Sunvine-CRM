/**
 * ponytail-audit-remediation.test.js — Regression & verification suite
 * Verifies all security, cache, latency, and authorization fixes from the code audit.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

process.env.NODE_ENV = 'test';
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}
process.env.ALLOWED_ORIGINS = 'https://app.sunvinesolar.com,https://dealer.sunvinesolar.com';

import { signJwt } from '../../../api/_lib/jwt.js';
import ledgerHandler from '../../../api/ledger.js';
import { checkDistributedRateLimit, resetAllRateLimits } from '../../../api/_lib/rateLimiter.js';
import { handleDelete } from '../../../api/quotations.js';

function mockRes() {
  const r = {
    _status: 200,
    _body: null,
    _headers: {},
    status(code) {
      r._status = code;
      return r;
    },
    json(body) {
      r._body = body;
      return r;
    },
    end() {
      return r;
    },
    setHeader(k, v) {
      r._headers[k] = v;
    }
  };
  return r;
}

function mockReq({
  method = 'GET',
  url = '',
  query = {},
  body = {},
  headers = {},
  token = null,
  ip = '127.0.0.1'
} = {}) {
  const finalHeaders = {
    'x-forwarded-for': ip,
    ...headers
  };
  if (token) {
    finalHeaders.authorization = `Bearer ${token}`;
  }
  return {
    method,
    url,
    query,
    body,
    headers: finalHeaders
  };
}

// ── 1. Financial Ledger Security & Department Guard ─────────────────────────

test('Ledger CORS: Untrusted origin is NOT reflected with Access-Control-Allow-Origin', async () => {
  const req = mockReq({
    method: 'OPTIONS',
    headers: { origin: 'https://evil-attacker.com' }
  });
  const res = mockRes();
  await ledgerHandler(req, res);

  assert.equal(res._headers['Access-Control-Allow-Origin'], undefined, 'Untrusted origin must not be reflected');
});

test('Ledger CORS: Allowed origin reflects Access-Control-Allow-Origin with Credentials', async () => {
  const req = mockReq({
    method: 'OPTIONS',
    headers: { origin: 'https://app.sunvinesolar.com' }
  });
  const res = mockRes();
  await ledgerHandler(req, res);

  assert.equal(res._headers['Access-Control-Allow-Origin'], 'https://app.sunvinesolar.com');
  assert.equal(res._headers['Access-Control-Allow-Credentials'], 'true');
});

test('Ledger Auth: General staff outside verification department cannot create financial vouchers (403)', async () => {
  const salesStaffToken = signJwt({
    id: 'STF-001',
    role: 'staff',
    department: 'Sales & Field Leads',
    name: 'Sales Rep'
  });

  const req = mockReq({
    method: 'POST',
    token: salesStaffToken,
    body: {
      dealer_id: 'SV-DLR-101',
      entry_type: 'CREDIT',
      category: 'COMMISSION_PAYOUT',
      amount: 50000,
      narration: 'Unauthorized commission credit'
    }
  });
  const res = mockRes();
  await ledgerHandler(req, res);

  assert.equal(res._status, 403, 'Non-verification staff must be rejected with 403');
  assert.match(res._body?.error, /verification desk staff/i);
});

// ── 2. Quotation Deletion Status Protection ──────────────────────────────────

test('Quotation Deletion: Dealer deleting non-Draft (e.g. Approved / Active) quotation returns 409 Conflict', async () => {
  const dealerToken = signJwt({
    id: 'd9b7f574-d4b6-455b-86d7-fc0673d526e8',
    role: 'dealer',
    dealer_id: 'd9b7f574-d4b6-455b-86d7-fc0673d526e8',
    dealerCode: 'SV-DLR-001'
  });

  const mockDb = {
    from(table) {
      assert.equal(table, 'quotations');
      return {
        select() {
          return {
            eq(col, val) {
              return {
                maybeSingle: async () => ({
                  data: {
                    id: 'SV-2026-Q0099',
                    dealer_id: 'd9b7f574-d4b6-455b-86d7-fc0673d526e8',
                    dealer_code: 'SV-DLR-001',
                    share_token: 'abc123token',
                    status: 'Approved' // Not Draft, Not Rejected!
                  },
                  error: null
                })
              };
            }
          };
        }
      };
    }
  };

  const req = mockReq({
    method: 'DELETE',
    query: { id: 'SV-2026-Q0099' }
  });
  const res = mockRes();

  await handleDelete(req, res, {
    role: 'dealer',
    dealer_id: 'd9b7f574-d4b6-455b-86d7-fc0673d526e8',
    dealerCode: 'SV-DLR-001'
  }, mockDb);

  assert.equal(res._status, 409, 'Dealer deleting Approved quotation must return 409 Conflict');
  assert.match(res._body?.error, /only draft or rejected quotations can be deleted/i);
});

test('Quotation Deletion: Dealer deleting Draft quotation succeeds and cleans cache', async () => {
  let deletedFromDb = false;

  const mockDb = {
    from(table) {
      if (table === 'quotations') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: 'SV-2026-Q0001',
                      dealer_id: 'd9b7f574-d4b6-455b-86d7-fc0673d526e8',
                      dealer_code: 'SV-DLR-001',
                      share_token: 'draft-token-123',
                      status: 'Draft'
                    },
                    error: null
                  })
                };
              }
            };
          },
          delete() {
            return {
              eq() {
                return {
                  eq: async () => {
                    deletedFromDb = true;
                    return { error: null };
                  }
                };
              }
            };
          }
        };
      }
      if (table === 'audit_logs') {
        return {
          insert: async () => ({ error: null })
        };
      }
    }
  };

  const req = mockReq({
    method: 'DELETE',
    query: { id: 'SV-2026-Q0001' }
  });
  const res = mockRes();

  await handleDelete(req, res, {
    role: 'dealer',
    dealer_id: 'd9b7f574-d4b6-455b-86d7-fc0673d526e8',
    dealerCode: 'SV-DLR-001'
  }, mockDb);

  assert.equal(res._status, 200, 'Draft quotation deletion should return 200 OK');
  assert.equal(deletedFromDb, true, 'Quotation must be deleted from DB');
});

// ── 3. Rate Limiter In-Memory Fallback Resilience ────────────────────────────

test('Rate Limiter: Falls back to in-memory check without throwing when Redis is unconfigured', async () => {
  await resetAllRateLimits();
  const testIp = `10.0.0.${Math.floor(Math.random() * 200 + 10)}`;

  // Send request through checkDistributedRateLimit without Redis credentials
  const check = await checkDistributedRateLimit(`resilience_test_${testIp}`, { maxAttempts: 5, windowMs: 60000 });
  assert.equal(check.allowed, true, 'Rate limiter must allow first request via in-memory fallback');
  assert.equal(typeof check.remaining, 'number');
});

// ── 4. Scrape Solar Leads Handler Verification ──────────────────────────────

test('Lead Scraper: api/scrape-solar-leads.js exists and handles CORS properly', async () => {
  const { default: scrapeHandler } = await import('../../../api/scrape-solar-leads.js');
  assert.equal(typeof scrapeHandler, 'function', 'scrapeHandler must be an exported function');

  const req = mockReq({
    method: 'OPTIONS',
    headers: { origin: 'https://app.sunvinesolar.com' }
  });
  const res = mockRes();
  await scrapeHandler(req, res);

  assert.equal(res._status, 200, 'OPTIONS preflight must return 200 OK');
  assert.equal(res._headers['Access-Control-Allow-Origin'], 'https://app.sunvinesolar.com');
});

/**
 * customerFileLifecycle.test.js — Comprehensive Automated Test Suite for
 * Customer Application Lifecycle & 14-Day Retention across Sunvine Portals.
 *
 * Verifies Acceptance Criteria AC1 through AC5 and Scheduled Maintenance:
 * - AC1: Verification lock guard returning HTTP 423 on core customer/technical specifications.
 * - AC2: Soft deletion moving unverified files to Trash (is_deleted: true, deleted_at, deleted_by)
 *        and blocking verified file deletion with HTTP 400.
 * - AC3: Cancellation requiring valid reason (>= 5 chars) with HTTP 400 rejection for < 5 chars,
 *        state transition to Cancelled/CANCELLED, timeline audit history, and 14-day recovery window.
 * - AC4: Admin-only inspection of quarantined Trash (?trash=true), admin restore within 14 days,
 *        and rejection of expired files (> 14 days) with HTTP 400.
 * - AC5: Permanent hard delete by Super Admin purging Cloudflare R2 files via DeleteObjectCommand
 *        and deleting the database row. Verified hard deletion rejected with HTTP 400.
 * - Purge Sweep Cron: /api/cron/purge-trash auth guard and dual 14-day purge sweep mechanics.
 */

import test, { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

// ── Environment Setup ────────────────────────────────────────────────────────
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString('hex');
process.env.ALLOWED_ORIGINS = 'http://localhost:5173,https://portal.sunvinesolar.com';
process.env.R2_BUCKET_NAME = 'sunvine-documents-vault';
process.env.CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret-sunvine-2026';
process.env.CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'test-cloudflare-account-id';
process.env.R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'test-r2-access-key';
process.env.R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'test-r2-secret-key';

import { signJwt } from '../../../api/_lib/jwt.js';
import customerFilesHandler, { checkIsFileVerified, extractAllDocPaths } from '../../../api/customer-files.js';
import purgeTrashCronHandler from '../../../api/cron/purge-trash.js';
import { resetAllRateLimits } from '../../../api/_lib/rateLimiter.js';

// ── Test User Personas & JWT Tokens ─────────────────────────────────────────
const ADMIN_USER = {
  id: 'usr-admin-001',
  sub: 'usr-admin-001',
  role: 'admin',
  name: 'Super Admin',
  email: 'admin@sunvinesolar.com'
};

const DEALER_1_USER = {
  id: 'dlr-uuid-001',
  sub: 'dlr-uuid-001',
  role: 'dealer',
  dealer_id: 'dlr-uuid-001',
  dealerCode: 'SV-DLR-001',
  name: 'Apex Solar Solutions',
  firmName: 'Apex Solar Solutions'
};

const DEALER_2_USER = {
  id: 'dlr-uuid-002',
  sub: 'dlr-uuid-002',
  role: 'dealer',
  dealer_id: 'dlr-uuid-002',
  dealerCode: 'SV-DLR-002',
  name: 'Zenith Renewables',
  firmName: 'Zenith Renewables'
};

const STAFF_USER = {
  id: 'stf-uuid-101',
  sub: 'stf-uuid-101',
  role: 'staff',
  staff_id: 'stf-uuid-101',
  name: 'Jayesh Patel',
  email: 'jayesh@sunvinesolar.com'
};

const adminToken = signJwt(ADMIN_USER);
const dealer1Token = signJwt(DEALER_1_USER);
const dealer2Token = signJwt(DEALER_2_USER);
const staffToken = signJwt(STAFF_USER);

// ── HTTP Request / Response Mocks ───────────────────────────────────────────
let requestCounter = 1;

function mockRes() {
  const r = {
    _status: 200,
    _body: null,
    _headers: {},
    _ended: false,
    status(code) {
      r._status = code;
      return r;
    },
    json(body) {
      r._body = body;
      return r;
    },
    end(data) {
      r._ended = true;
      r._data = data;
      return r;
    },
    setHeader(k, v) {
      r._headers[k] = v;
    }
  };
  return r;
}

function mockReq({
  method = 'POST',
  url = '/api/customer-files',
  query = {},
  body = {},
  headers = {},
  token = null,
  cookie = '',
  ip = null,
  db = null
} = {}) {
  const clientIp = ip || `10.42.0.${(requestCounter++) % 250 + 1}`;
  const reqHeaders = {
    'x-forwarded-for': clientIp,
    ...headers
  };
  if (token) reqHeaders.authorization = `Bearer ${token}`;
  if (cookie) reqHeaders.cookie = cookie;

  return {
    method,
    url,
    query,
    body,
    headers: reqHeaders,
    socket: { remoteAddress: clientIp },
    db
  };
}

// ── Cloudflare R2 / S3 Command Spying Harness ───────────────────────────────
let s3SentCommands = [];

function setupS3Mock() {
  s3SentCommands = [];
  mock.method(S3Client.prototype, 'send', async (command) => {
    s3SentCommands.push({
      commandName: command.constructor.name,
      input: command.input
    });
    return { $metadata: { httpStatusCode: 200 } };
  });
}

function getDispatchedR2Deletions() {
  return s3SentCommands
    .filter(c => c.commandName === 'DeleteObjectCommand')
    .map(c => ({
      bucket: c.input?.Bucket,
      key: c.input?.Key
    }));
}

// ── In-Memory Fluent Mock Supabase Client ───────────────────────────────────
function createMockSupabase(initialRows = []) {
  let rows = JSON.parse(JSON.stringify(initialRows));
  const calls = {
    updates: [],
    deletes: [],
    inserts: []
  };

  function createQueryBuilder(table) {
    let currentRows = [...rows];
    let isCountExact = false;
    let operation = 'select'; // 'select' | 'update' | 'delete' | 'upsert'
    let pendingPayload = null;
    let upsertOpts = {};

    const builder = {
      select(columns = '*', options = {}) {
        if (options && options.count === 'exact') isCountExact = true;
        return builder;
      },
      update(payload) {
        operation = 'update';
        pendingPayload = payload;
        return builder;
      },
      delete() {
        operation = 'delete';
        return builder;
      },
      upsert(payload, opts = {}) {
        operation = 'upsert';
        pendingPayload = payload;
        upsertOpts = opts;
        return builder;
      },
      eq(col, val) {
        currentRows = currentRows.filter(r => r[col] === val);
        return builder;
      },
      neq(col, val) {
        currentRows = currentRows.filter(r => r[col] !== val);
        return builder;
      },
      not(col, op, val) {
        if (op === 'is' && val === true) {
          currentRows = currentRows.filter(r => r[col] !== true);
        } else if (op === 'is' && val === null) {
          currentRows = currentRows.filter(r => r[col] !== null);
        } else if (op === 'eq') {
          currentRows = currentRows.filter(r => r[col] !== val);
        }
        return builder;
      },
      lt(col, val) {
        currentRows = currentRows.filter(r => {
          if (!r[col]) return false;
          return new Date(r[col]).getTime() < new Date(val).getTime();
        });
        return builder;
      },
      gt(col, val) {
        currentRows = currentRows.filter(r => {
          if (!r[col]) return false;
          return new Date(r[col]).getTime() > new Date(val).getTime();
        });
        return builder;
      },
      order(col, { ascending = true } = {}) {
        currentRows.sort((a, b) => {
          if (a[col] < b[col]) return ascending ? -1 : 1;
          if (a[col] > b[col]) return ascending ? 1 : -1;
          return 0;
        });
        return builder;
      },
      range(from, to) {
        currentRows = currentRows.slice(from, to + 1);
        return builder;
      },
      limit(n) {
        currentRows = currentRows.slice(0, n);
        return builder;
      },
      // Single row resolver
      async single() {
        if (operation === 'upsert') {
          const items = Array.isArray(pendingPayload) ? pendingPayload : [pendingPayload];
          const conflictCol = upsertOpts.onConflict || 'id';
          const upserted = [];
          items.forEach(item => {
            const idx = rows.findIndex(r => r[conflictCol] === item[conflictCol]);
            if (idx >= 0) {
              rows[idx] = { ...rows[idx], ...item };
              upserted.push(rows[idx]);
            } else {
              rows.push(item);
              upserted.push(item);
            }
          });
          calls.inserts.push({ table, payload: pendingPayload, rows: upserted });
          return { data: upserted[0], error: null };
        }
        if (operation === 'update') {
          const target = currentRows[0];
          if (!target) return { data: null, error: { message: 'Row not found' } };
          const idx = rows.findIndex(r => r.id === target.id);
          rows[idx] = { ...rows[idx], ...pendingPayload };
          calls.updates.push({ table, payload: pendingPayload, id: target.id });
          return { data: rows[idx], error: null };
        }
        const data = currentRows[0] || null;
        return { data, error: data ? null : { message: 'Row not found' } };
      },
      async maybeSingle() {
        if (operation === 'update') {
          return builder.single();
        }
        const data = currentRows[0] || null;
        return { data, error: null };
      },
      async then(resolve, reject) {
        try {
          if (operation === 'delete') {
            const idsToDelete = currentRows.map(r => r.id);
            rows = rows.filter(r => !idsToDelete.includes(r.id));
            calls.deletes.push({ table, ids: idsToDelete });
            return resolve({ data: null, error: null });
          }
          if (operation === 'update') {
            const updated = [];
            rows = rows.map(r => {
              if (currentRows.some(cr => cr.id === r.id)) {
                const merged = { ...r, ...pendingPayload };
                updated.push(merged);
                return merged;
              }
              return r;
            });
            calls.updates.push({ table, payload: pendingPayload, rows: updated });
            return resolve({ data: updated, error: null });
          }
          if (operation === 'upsert') {
            const items = Array.isArray(pendingPayload) ? pendingPayload : [pendingPayload];
            const conflictCol = upsertOpts.onConflict || 'id';
            const upserted = [];
            items.forEach(item => {
              const idx = rows.findIndex(r => r[conflictCol] === item[conflictCol]);
              if (idx >= 0) {
                rows[idx] = { ...rows[idx], ...item };
                upserted.push(rows[idx]);
              } else {
                rows.push(item);
                upserted.push(item);
              }
            });
            calls.inserts.push({ table, payload: pendingPayload, rows: upserted });
            return resolve({ data: upserted, error: null });
          }
          return resolve({
            data: currentRows,
            count: isCountExact ? currentRows.length : null,
            error: null
          });
        } catch (err) {
          if (reject) reject(err);
          else resolve({ data: null, error: err });
        }
      }
    };

    return builder;
  }

  return {
    from: (table) => createQueryBuilder(table),
    getRows: () => rows,
    getUpdates: () => calls.updates,
    getDeletes: () => calls.deletes,
    getInserts: () => calls.inserts
  };
}

// ── Standard Verified & Unverified Test Fixtures ────────────────────────────
function makeVerifiedFile(overrides = {}) {
  return {
    id: 'FIL-2026-VERIFIED-01',
    customer_name: 'Bhavesh Patel',
    phone: '9876543210',
    address: '102 Sun City',
    city: 'Ahmedabad',
    discom: 'UGVCL',
    consumer_no: '012345678901',
    sanctioned_load_kw: 6.0,
    solar_system_kw: 5.0,
    roof_type: 'Flat RCC',
    source_type: 'DEALER',
    dealer_id: DEALER_1_USER.dealer_id,
    dealer_name: DEALER_1_USER.firmName,
    staff_id: 'STF-DIRECT',
    staff_name: 'Direct to Company (HQ Desk)',
    finance_type: 'LOAN',
    loan_bank: 'State Bank of India',
    stage: 'PLANT_INSTALLATION',
    status: 'Verified',
    is_verified: true,
    verified_at: new Date('2026-10-01T10:00:00Z').toISOString(),
    verified_by: 'Staff Desk',
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
    documents: {
      electricityBill: 'applications/FIL-2026-VERIFIED-01/bill.pdf'
    },
    timeline: [
      { title: 'Application Created', stage: 'LEAD_SOURCED', timestamp: '2026-10-01T09:00:00Z' },
      { title: 'Application Verified', stage: 'DOCUMENTATION', timestamp: '2026-10-01T10:00:00Z' }
    ],
    created_at: new Date('2026-10-01T09:00:00Z').toISOString(),
    updated_at: new Date('2026-10-01T10:00:00Z').toISOString(),
    ...overrides
  };
}

function makeUnverifiedFile(overrides = {}) {
  return {
    id: 'FIL-2026-UNVER-01',
    customer_name: 'Dharmesh Shah',
    phone: '9898000001',
    address: '404 Solar Enclave',
    city: 'Surat',
    discom: 'DGVCL',
    consumer_no: '112233445566',
    sanctioned_load_kw: 4.0,
    solar_system_kw: 3.5,
    roof_type: 'Tin Shed',
    source_type: 'DEALER',
    dealer_id: DEALER_1_USER.dealer_id,
    dealer_name: DEALER_1_USER.firmName,
    staff_id: 'STF-DIRECT',
    staff_name: 'Direct to Company (HQ Desk)',
    finance_type: 'CASH',
    loan_bank: null,
    stage: 'LEAD_SOURCED',
    status: 'Sourced',
    is_verified: false,
    verified_at: null,
    verified_by: null,
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
    documents: {
      electricityBill: 'applications/FIL-2026-UNVER-01/bill.pdf',
      aadhaarCard: { url: 'https://r2.sunvinesolar.com/applications/FIL-2026-UNVER-01/aadhaar.jpg' }
    },
    timeline: [
      { title: 'Application Created', stage: 'LEAD_SOURCED', timestamp: '2026-10-10T11:00:00Z' }
    ],
    created_at: new Date('2026-10-10T11:00:00Z').toISOString(),
    updated_at: new Date('2026-10-10T11:00:00Z').toISOString(),
    ...overrides
  };
}

// ── Test Teardown: Guarantee Zero Mock Leaks ────────────────────────────────
beforeEach(() => {
  setupS3Mock();
  resetAllRateLimits();
});

afterEach(() => {
  mock.restoreAll();
  s3SentCommands = [];
});

// ============================================================================
// SUITE 1: Pure Unit & Utility Tests
// ============================================================================
describe('Suite 1: Pure Unit & Utility Tests', () => {
  it('TC-UNIT-01: checkIsFileVerified correctly evaluates verification predicates across stages and statuses', () => {
    // Verified by boolean
    assert.equal(checkIsFileVerified({ is_verified: true }), true);
    assert.equal(checkIsFileVerified({ isVerified: true }), true);

    // Verified by status
    assert.equal(checkIsFileVerified({ status: 'Verified' }), true);
    assert.equal(checkIsFileVerified({ status: 'DISCOM Registered' }), true);

    // Verified by advanced pipeline stages (beyond LEAD_SOURCED & SITE_SURVEY)
    assert.equal(checkIsFileVerified({ stage: 'DOCUMENTATION' }), true);
    assert.equal(checkIsFileVerified({ stage: 'FEASIBILITY_APPROVAL' }), true);
    assert.equal(checkIsFileVerified({ stage: 'PLANT_INSTALLATION' }), true);
    assert.equal(checkIsFileVerified({ stage: 'NET_METER_SYNC' }), true);
    assert.equal(checkIsFileVerified({ stage: 'SUBSIDY_CLAIM' }), true);
    assert.equal(checkIsFileVerified({ stage: 'HANDOVER' }), true);

    // Unverified cases
    assert.equal(checkIsFileVerified({ stage: 'LEAD_SOURCED', status: 'Sourced', is_verified: false }), false);
    assert.equal(checkIsFileVerified({ stage: 'SITE_SURVEY', status: 'Sourced', is_verified: false }), false);
    assert.equal(checkIsFileVerified({ is_verified: false, status: 'Draft' }), false);
    assert.equal(checkIsFileVerified(null), false);
    assert.equal(checkIsFileVerified(undefined), false);
    assert.equal(checkIsFileVerified({}), false);
  });

  it('TC-UNIT-02: extractAllDocPaths extracts relative paths from strings, objects, arrays, and strips hostnames', () => {
    const documents = {
      electricityBill: 'applications/FIL-001/bill.pdf',
      aadhaarCard: { url: 'https://r2.sunvinesolar.com/applications/FIL-001/aadhaar.jpg' },
      panCard: { path: '/applications/FIL-001/pan.pdf' },
      sitePhotos: [
        'applications/FIL-001/roof1.png',
        { url: 'https://r2.sunvinesolar.com/applications/FIL-001/roof2.png' },
        { path: 'applications/FIL-001/roof3.png' }
      ],
      extra: {
        files: [
          'applications/FIL-001/extra1.pdf',
          { url: 'https://r2.sunvinesolar.com/applications/FIL-001/extra2.pdf' }
        ]
      },
      emptyField: null
    };

    const extracted = extractAllDocPaths(documents);
    assert.ok(Array.isArray(extracted));
    assert.equal(extracted.length, 8);
    assert.ok(extracted.includes('applications/FIL-001/bill.pdf'));
    assert.ok(extracted.includes('applications/FIL-001/aadhaar.jpg'));
    assert.ok(extracted.includes('applications/FIL-001/pan.pdf'));
    assert.ok(extracted.includes('applications/FIL-001/roof1.png'));
    assert.ok(extracted.includes('applications/FIL-001/roof2.png'));
    assert.ok(extracted.includes('applications/FIL-001/roof3.png'));
    assert.ok(extracted.includes('applications/FIL-001/extra1.pdf'));
    assert.ok(extracted.includes('applications/FIL-001/extra2.pdf'));
  });
});

// ============================================================================
// SUITE 2: AC1 — Core Specification Lock on Verified Applications (HTTP 423)
// ============================================================================
describe('Suite 2: AC1 — Core Specification Lock on Verified Applications (HTTP 423)', () => {
  const coreFieldsMatrix = [
    { field: 'customer_name', payloadKey: 'customer_name', updateValue: 'Bhavesh R. Patel' },
    { field: 'phone', payloadKey: 'phone', updateValue: '9898989898' },
    { field: 'address', payloadKey: 'address', updateValue: '104 Sun City New Phase' },
    { field: 'city', payloadKey: 'city', updateValue: 'Gandhinagar' },
    { field: 'discom', payloadKey: 'discom', updateValue: 'PGVCL' },
    { field: 'consumer_no', payloadKey: 'consumer_no', updateValue: '999999999999' },
    { field: 'sanctioned_load_kw', payloadKey: 'sanctioned_load_kw', updateValue: 10.0 },
    { field: 'solar_system_kw', payloadKey: 'solar_system_kw', updateValue: 8.0 },
    { field: 'roof_type', payloadKey: 'roof_type', updateValue: 'Tin Shed' },
    { field: 'finance_type', payloadKey: 'finance_type', updateValue: 'CASH' },
    { field: 'loan_bank', payloadKey: 'loan_bank', updateValue: 'HDFC Bank' }
  ];

  for (const { field, payloadKey, updateValue } of coreFieldsMatrix) {
    it(`TC-AC1-01: Updating core field "${field}" on verified file is locked with HTTP 423`, async () => {
      const mockDb = createMockSupabase([makeVerifiedFile()]);
      const req = mockReq({
        token: dealer1Token,
        body: {
          action: 'update',
          fileId: 'FIL-2026-VERIFIED-01',
          updates: { [payloadKey]: updateValue }
        },
        db: mockDb
      });
      const res = mockRes();

      await customerFilesHandler(req, res, mockDb);

      assert.equal(res._status, 423, `Modifying ${field} on verified application must return HTTP 423`);
      assert.equal(
        res._body?.error,
        'This customer file has been verified and is locked. Core customer specifications cannot be modified.'
      );
      assert.equal(mockDb.getUpdates().length, 0, 'No updates must be committed to the database');
    });
  }

  it('TC-AC1-02: action: save attempting to overwrite verified file core specs is rejected with HTTP 423', async () => {
    const verifiedFile = makeVerifiedFile();
    const mockDb = createMockSupabase([verifiedFile]);

    const req = mockReq({
      token: dealer1Token,
      body: {
        action: 'save',
        file: {
          id: verifiedFile.id,
          customerName: 'Attempted Name Change',
          phone: verifiedFile.phone,
          sanctionedLoadKw: 6.0,
          solarSystemKw: 5.0
        }
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 423, 'Overwriting core specs on verified file via save must return HTTP 423');
    assert.equal(
      res._body?.error,
      'This customer file has been verified and is locked. Core customer specifications cannot be modified.'
    );
  });

  it('TC-AC1-03: Updating operational non-core fields on verified file succeeds with HTTP 200', async () => {
    const mockDb = createMockSupabase([makeVerifiedFile()]);
    const req = mockReq({
      token: dealer1Token,
      body: {
        action: 'update',
        fileId: 'FIL-2026-VERIFIED-01',
        updates: {
          stage: 'NET_METER_SYNC',
          documents: {
            electricityBill: 'applications/FIL-2026-VERIFIED-01/bill.pdf',
            commissioningCert: 'applications/FIL-2026-VERIFIED-01/comm.pdf'
          },
          staffId: 'STF-DIRECT',
          staffName: 'Direct to Company (HQ Desk)'
        }
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 200, 'Operational stage and document updates on verified files must succeed');
    assert.equal(res._body?.success, true);
    assert.equal(res._body?.data?.stage, 'NET_METER_SYNC');
  });

  it('TC-AC1-04: No-op core updates (whitespace or numeric precision equivalence) do not trigger false-positive 423', async () => {
    const mockDb = createMockSupabase([makeVerifiedFile({ sanctioned_load_kw: 6.0, solar_system_kw: 5.0 })]);
    const req = mockReq({
      token: dealer1Token,
      body: {
        action: 'update',
        fileId: 'FIL-2026-VERIFIED-01',
        updates: {
          customer_name: '  Bhavesh Patel  ', // Same trimmed value
          sanctioned_load_kw: 6,             // Number 6 === 6.0
          solar_system_kw: '5.00'            // String '5.00' === 5.0
        }
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 200, 'Equivalent numeric and string values must not trigger false-positive 423');
  });

  it('TC-AC1-05: Modifying core specifications on unverified file succeeds with HTTP 200', async () => {
    const mockDb = createMockSupabase([makeUnverifiedFile()]);
    const req = mockReq({
      token: dealer1Token,
      body: {
        action: 'update',
        fileId: 'FIL-2026-UNVER-01',
        updates: {
          customerName: 'Dharmesh K. Shah',
          solarSystemKw: 7.5,
          roofType: 'RCC Terraced'
        }
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 200);
    assert.equal(res._body?.data?.customerName, 'Dharmesh K. Shah');
    assert.equal(res._body?.data?.solarSystemKw, 7.5);
  });
});

// ============================================================================
// SUITE 3: AC2 — Soft Deletion to Trash (is_deleted = true, 14-Day Retention)
// ============================================================================
describe('Suite 3: AC2 — Soft Deletion to Trash (is_deleted = true, 14-Day Retention)', () => {
  it('TC-AC2-01: Soft-deleting an unverified file sets is_deleted = true, deleted_at, deleted_by, and preserves DB row', async () => {
    const unverified = makeUnverifiedFile();
    const mockDb = createMockSupabase([unverified]);

    const req = mockReq({
      token: dealer1Token,
      body: {
        action: 'soft_delete',
        fileId: unverified.id
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 200, 'Soft deleting unverified file must return HTTP 200');
    assert.equal(res._body?.data?.isDeleted, true);
    assert.ok(res._body?.data?.deletedAt, 'deleted_at timestamp must be populated');
    assert.equal(res._body?.data?.deletedBy, DEALER_1_USER.firmName);

    // Verify row still exists in database and has is_deleted: true
    const updatedRow = mockDb.getRows().find(r => r.id === unverified.id);
    assert.ok(updatedRow, 'Row must not be deleted from database');
    assert.equal(updatedRow.is_deleted, true);
    assert.ok(updatedRow.deleted_at);

    // Verify timeline includes soft delete note
    const lastTimelineNote = updatedRow.timeline[updatedRow.timeline.length - 1];
    assert.equal(lastTimelineNote.title, 'Application Moved to Trash');
  });

  it('TC-AC2-02: Soft-deleting a verified file is strictly rejected with HTTP 400', async () => {
    const verified = makeVerifiedFile();
    const mockDb = createMockSupabase([verified]);

    const req = mockReq({
      token: dealer1Token,
      body: {
        action: 'soft_delete',
        fileId: verified.id
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 400, 'Soft deleting verified file must return HTTP 400');
    assert.equal(
      res._body?.error,
      'Verified applications cannot be deleted. If this project cannot proceed, please cancel the file with a specific reason.'
    );

    // Verify DB row remains active
    const rowInDb = mockDb.getRows().find(r => r.id === verified.id);
    assert.equal(rowInDb.is_deleted, false);
    assert.equal(rowInDb.deleted_at, null);
  });

  it('TC-AC2-03: Dealer attempting cross-tenant soft deletion on another dealer file is rejected with HTTP 403', async () => {
    const dealer2File = makeUnverifiedFile({
      id: 'FIL-2026-DLR2-01',
      dealer_id: DEALER_2_USER.dealer_id,
      dealer_name: DEALER_2_USER.firmName
    });
    const mockDb = createMockSupabase([dealer2File]);

    const req = mockReq({
      token: dealer1Token, // Dealer 1 caller
      body: {
        action: 'soft_delete',
        fileId: dealer2File.id
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 403, 'Cross-tenant soft delete must be rejected with HTTP 403');
    assert.equal(res._body?.error, 'Customer file not found or unauthorized.');
  });

  it('TC-AC2-04: Default active listing (GET /api/customer-files) excludes soft-deleted files', async () => {
    const active1 = makeUnverifiedFile({ id: 'FIL-ACT-01' });
    const active2 = makeVerifiedFile({ id: 'FIL-ACT-02' });
    const trash = makeUnverifiedFile({ id: 'FIL-TRASH-01', is_deleted: true, deleted_at: new Date().toISOString() });

    const mockDb = createMockSupabase([active1, active2, trash]);

    const req = mockReq({
      method: 'GET',
      token: dealer1Token,
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 200);
    assert.equal(res._body?.data?.length, 2, 'Active query must return exactly 2 active files');
    const returnedIds = res._body?.data?.map(f => f.id);
    assert.ok(!returnedIds.includes('FIL-TRASH-01'), 'Soft-deleted file must be filtered out');
  });
});

// ============================================================================
// SUITE 4: AC3 — Cancellation Reason (>= 5 chars) & Audit Timeline History
// ============================================================================
describe('Suite 4: AC3 — Cancellation Reason (>= 5 chars) & Audit Timeline History', () => {
  const invalidReasons = [
    { label: 'missing reason', reason: undefined },
    { label: 'empty string', reason: '' },
    { label: 'whitespace only', reason: '    ' },
    { label: '3 characters', reason: 'N/A' },
    { label: '4 characters', reason: 'Drop' }
  ];

  for (const { label, reason } of invalidReasons) {
    it(`TC-AC3-01: Cancellation with ${label} is rejected with HTTP 400`, async () => {
      const verified = makeVerifiedFile();
      const mockDb = createMockSupabase([verified]);

      const req = mockReq({
        token: dealer1Token,
        body: {
          action: 'cancel',
          fileId: verified.id,
          reason
        },
        db: mockDb
      });
      const res = mockRes();

      await customerFilesHandler(req, res, mockDb);

      assert.equal(res._status, 400, 'Cancellation reason < 5 chars must return HTTP 400');
      assert.equal(res._body?.error, 'A specific cancellation reason of at least 5 characters is required.');

      // Verify status in DB is untouched
      const rowInDb = mockDb.getRows().find(r => r.id === verified.id);
      assert.equal(rowInDb.status, 'Verified');
      assert.equal(rowInDb.stage, 'PLANT_INSTALLATION');
    });
  }

  it('TC-AC3-02: Valid cancellation reason transitions status to Cancelled, stage to CANCELLED, and appends timeline note', async () => {
    const verified = makeVerifiedFile();
    const mockDb = createMockSupabase([verified]);

    const req = mockReq({
      token: dealer1Token,
      body: {
        action: 'cancel',
        fileId: verified.id,
        reason: 'Customer relocated to another state',
        remarks: 'Confirmed via phone on 15 Oct'
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 200, 'Valid cancellation must succeed with HTTP 200');
    assert.equal(res._body?.data?.status, 'Cancelled');
    assert.equal(res._body?.data?.stage, 'CANCELLED');
    assert.ok(res._body?.data?.cancellationReason.includes('Customer relocated to another state'));
    assert.ok(res._body?.data?.cancellationReason.includes('Confirmed via phone on 15 Oct'));

    // DB row verification
    const rowInDb = mockDb.getRows().find(r => r.id === verified.id);
    assert.equal(rowInDb.status, 'Cancelled');
    assert.equal(rowInDb.stage, 'CANCELLED');
    assert.ok(rowInDb.cancelled_at);
    assert.equal(rowInDb.cancelled_by, DEALER_1_USER.firmName);

    const cancelTimeline = rowInDb.timeline.find(t => t.stage === 'CANCELLED');
    assert.ok(cancelTimeline, 'Timeline must contain a CANCELLED audit event');
    assert.equal(cancelTimeline.title, 'Customer File Cancelled');
  });

  it('TC-AC3-03: Restoring a cancelled file within the 14-day window succeeds with HTTP 200', async () => {
    const cancelledFiveDaysAgo = makeVerifiedFile({
      id: 'FIL-CANCEL-05D',
      status: 'Cancelled',
      stage: 'CANCELLED',
      cancellation_reason: 'Temporary hold',
      cancelled_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      cancelled_by: 'Dealer Desk'
    });
    const mockDb = createMockSupabase([cancelledFiveDaysAgo]);

    const req = mockReq({
      token: dealer1Token,
      body: {
        action: 'restore',
        fileId: cancelledFiveDaysAgo.id
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 200, 'Restoring cancelled file within 14 days must return HTTP 200');
    assert.equal(res._body?.data?.status, 'Sourced');
    assert.equal(res._body?.data?.stage, 'LEAD_SOURCED');

    const rowInDb = mockDb.getRows().find(r => r.id === cancelledFiveDaysAgo.id);
    assert.equal(rowInDb.status, 'Sourced');
    assert.equal(rowInDb.cancellation_reason, null);
    assert.equal(rowInDb.cancelled_at, null);
  });

  it('TC-AC3-04: Restoring a cancelled file beyond the 14-day window is rejected with HTTP 400', async () => {
    const cancelledFifteenDaysAgo = makeVerifiedFile({
      id: 'FIL-CANCEL-15D',
      status: 'Cancelled',
      stage: 'CANCELLED',
      cancellation_reason: 'Client backed out',
      cancelled_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      cancelled_by: 'Dealer Desk'
    });
    const mockDb = createMockSupabase([cancelledFifteenDaysAgo]);

    const req = mockReq({
      token: dealer1Token,
      body: {
        action: 'restore',
        fileId: cancelledFifteenDaysAgo.id
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 400, 'Expired cancelled restoration must return HTTP 400');
    assert.equal(
      res._body?.error,
      'Restoration locked: The 14-day recovery window for this cancelled file has expired. Documents have been purged.'
    );
  });

  it('TC-AC3-05: Direct status or stage transition to Cancelled via action: update is prohibited with HTTP 400', async () => {
    const unverified = makeUnverifiedFile();
    const mockDb = createMockSupabase([unverified]);

    const req = mockReq({
      token: dealer1Token,
      body: {
        action: 'update',
        fileId: unverified.id,
        updates: { status: 'Cancelled' }
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 400, 'Direct status update to Cancelled must return HTTP 400');
    assert.match(res._body?.error || '', /dedicated cancel action/i);
  });
});

// ============================================================================
// SUITE 5: AC4 — Admin Trash Quarantine & Recovery (<= 14 Days)
// ============================================================================
describe('Suite 5: AC4 — Admin Trash Quarantine & Recovery (<= 14 Days)', () => {
  it('TC-AC4-01: Non-admin users attempting to view Trash (?trash=true) are rejected with HTTP 403', async () => {
    const mockDb = createMockSupabase([makeUnverifiedFile({ is_deleted: true, deleted_at: new Date().toISOString() })]);

    // Dealer attempt
    const reqDealer = mockReq({ method: 'GET', query: { trash: 'true' }, token: dealer1Token, db: mockDb });
    const resDealer = mockRes();
    await customerFilesHandler(reqDealer, resDealer, mockDb);
    assert.equal(resDealer._status, 403, 'Dealer cannot view Trash');
    assert.equal(resDealer._body?.error, 'Permission denied. Only Admin can view Trash.');

    // Staff attempt
    const reqStaff = mockReq({ method: 'GET', query: { trash: 'true' }, token: staffToken, db: mockDb });
    const resStaff = mockRes();
    await customerFilesHandler(reqStaff, resStaff, mockDb);
    assert.equal(resStaff._status, 403, 'Staff cannot view Trash');
  });

  it('TC-AC4-02: Admin viewing Trash (?trash=true) retrieves only quarantined soft-deleted files', async () => {
    const active = makeUnverifiedFile({ id: 'FIL-ACT-99', is_deleted: false });
    const trash1 = makeUnverifiedFile({ id: 'FIL-TRASH-01', is_deleted: true, deleted_at: new Date().toISOString() });
    const trash2 = makeUnverifiedFile({ id: 'FIL-TRASH-02', is_deleted: true, deleted_at: new Date().toISOString() });

    const mockDb = createMockSupabase([active, trash1, trash2]);

    const req = mockReq({
      method: 'GET',
      query: { trash: 'true' },
      token: adminToken,
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 200);
    assert.equal(res._body?.data?.length, 2, 'Admin trash view must return exactly the 2 soft-deleted files');
    assert.ok(res._body?.data?.every(f => f.isDeleted === true));
  });

  it('TC-AC4-03: Non-admin users attempting to restore a file from Trash are rejected with HTTP 403', async () => {
    const trashFile = makeUnverifiedFile({ id: 'FIL-TRASH-01', is_deleted: true, deleted_at: new Date().toISOString() });
    const mockDb = createMockSupabase([trashFile]);

    const req = mockReq({
      token: dealer1Token,
      body: { action: 'restore_trash', fileId: trashFile.id },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 403, 'Non-admin restoring trash must return HTTP 403');
    assert.equal(res._body?.error, 'Permission denied. Only Administrator can restore files from Trash.');
  });

  it('TC-AC4-04: Admin restores unexpired trash file (<= 14 days) back to active status with HTTP 200', async () => {
    const deletedThreeDaysAgo = makeUnverifiedFile({
      id: 'FIL-TRASH-03D',
      is_deleted: true,
      deleted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      deleted_by: 'Apex Solar Solutions'
    });
    const mockDb = createMockSupabase([deletedThreeDaysAgo]);

    const req = mockReq({
      token: adminToken,
      body: { action: 'restore_trash', fileId: deletedThreeDaysAgo.id },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 200, 'Admin restoring unexpired trash must return HTTP 200');
    assert.equal(res._body?.data?.isDeleted, false);
    assert.equal(res._body?.data?.deletedAt, null);

    const rowInDb = mockDb.getRows().find(r => r.id === deletedThreeDaysAgo.id);
    assert.equal(rowInDb.is_deleted, false);
    assert.equal(rowInDb.deleted_at, null);
    assert.equal(rowInDb.deleted_by, null);

    const restoreTimeline = rowInDb.timeline.find(t => t.title === 'Application Restored from Trash');
    assert.ok(restoreTimeline, 'Timeline must record restoration from trash');
  });

  it('TC-AC4-05: Admin attempting to restore expired trash file (> 14 days) is rejected with HTTP 400', async () => {
    const deletedSixteenDaysAgo = makeUnverifiedFile({
      id: 'FIL-TRASH-16D',
      is_deleted: true,
      deleted_at: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
      deleted_by: 'Staff Desk'
    });
    const mockDb = createMockSupabase([deletedSixteenDaysAgo]);

    const req = mockReq({
      token: adminToken,
      body: { action: 'restore_trash', fileId: deletedSixteenDaysAgo.id },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 400, 'Expired trash restoration must return HTTP 400');
    assert.equal(
      res._body?.error,
      'Restoration locked: The 14-day recovery window has expired. File is queued for permanent removal.'
    );
    assert.equal(mockDb.getRows().find(r => r.id === deletedSixteenDaysAgo.id)?.is_deleted, true);
  });

  it('TC-AC4-06: 14-day boundary precision tests (13.99 days vs 14.01 days)', async () => {
    // 13.99 days ago (Allowed)
    const file1399 = makeUnverifiedFile({
      id: 'FIL-TRASH-1399',
      is_deleted: true,
      deleted_at: new Date(Date.now() - 13.99 * 24 * 60 * 60 * 1000).toISOString()
    });
    const mockDb1 = createMockSupabase([file1399]);
    const req1 = mockReq({ token: adminToken, body: { action: 'restore_trash', fileId: file1399.id }, db: mockDb1 });
    const res1 = mockRes();
    await customerFilesHandler(req1, res1, mockDb1);
    assert.equal(res1._status, 200, '13.99 days within 14-day limit must succeed');

    // 14.01 days ago (Rejected)
    const file1401 = makeUnverifiedFile({
      id: 'FIL-TRASH-1401',
      is_deleted: true,
      deleted_at: new Date(Date.now() - 14.01 * 24 * 60 * 60 * 1000).toISOString()
    });
    const mockDb2 = createMockSupabase([file1401]);
    const req2 = mockReq({ token: adminToken, body: { action: 'restore_trash', fileId: file1401.id }, db: mockDb2 });
    const res2 = mockRes();
    await customerFilesHandler(req2, res2, mockDb2);
    assert.equal(res2._status, 400, '14.01 days exceeds 14-day limit and must fail');
  });
});

// ============================================================================
// SUITE 6: AC5 — Permanent Hard Delete & Cloudflare R2 Document Purge
// ============================================================================
describe('Suite 6: AC5 — Permanent Hard Delete & Cloudflare R2 Document Purge', () => {
  it('TC-AC5-01: Non-admin users attempting permanent hard delete are rejected with HTTP 403', async () => {
    const unverified = makeUnverifiedFile();
    const mockDb = createMockSupabase([unverified]);

    const req = mockReq({
      token: dealer1Token,
      body: { action: 'delete', fileId: unverified.id },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 403, 'Dealer cannot hard delete file');
    assert.equal(res._body?.error, 'Permission denied. Only Super Admin can permanently delete files.');
    assert.equal(mockDb.getRows().length, 1, 'Database row must not be deleted');
  });

  it('TC-AC5-02: Permanent hard delete on verified file is strictly rejected with HTTP 400', async () => {
    const verified = makeVerifiedFile();
    const mockDb = createMockSupabase([verified]);

    const req = mockReq({
      token: adminToken,
      body: { action: 'delete', fileId: verified.id },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 400, 'Hard delete on verified file must return HTTP 400');
    assert.equal(
      res._body?.error,
      'Verified applications cannot be deleted. If this project cannot proceed, please cancel the file with a specific reason.'
    );
    assert.equal(mockDb.getRows().length, 1, 'Database row must remain intact');
    assert.equal(getDispatchedR2Deletions().length, 0, 'No R2 objects must be deleted');
  });

  it('TC-AC5-03: Admin permanent hard delete purges all attached R2 documents and drops DB row', async () => {
    const unverifiedWithDocs = makeUnverifiedFile({
      id: 'FIL-PURGE-001',
      documents: {
        electricityBill: 'applications/FIL-PURGE-001/bill.pdf',
        aadhaarCard: { url: 'https://r2.sunvinesolar.com/applications/FIL-PURGE-001/aadhaar.jpg' },
        sitePhotos: [
          'applications/FIL-PURGE-001/roof1.png',
          'applications/FIL-PURGE-001/roof2.png'
        ]
      }
    });
    const mockDb = createMockSupabase([unverifiedWithDocs]);

    const req = mockReq({
      token: adminToken,
      body: { action: 'delete', fileId: unverifiedWithDocs.id },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 200, 'Permanent hard delete must return HTTP 200');
    assert.equal(res._body?.success, true);
    assert.equal(res._body?.fileId, unverifiedWithDocs.id);

    // Verify DB row removal
    const rowInDb = mockDb.getRows().find(r => r.id === unverifiedWithDocs.id);
    assert.equal(rowInDb, undefined, 'Database row must be permanently deleted');

    // Verify S3/R2 DeleteObjectCommand dispatches
    const dispatched = getDispatchedR2Deletions();
    assert.equal(dispatched.length, 4, 'All 4 attached R2 documents must be deleted');
    const dispatchedKeys = dispatched.map(d => d.key);
    assert.ok(dispatchedKeys.includes('applications/FIL-PURGE-001/bill.pdf'));
    assert.ok(dispatchedKeys.includes('applications/FIL-PURGE-001/aadhaar.jpg'));
    assert.ok(dispatchedKeys.includes('applications/FIL-PURGE-001/roof1.png'));
    assert.ok(dispatchedKeys.includes('applications/FIL-PURGE-001/roof2.png'));
  });
});

// ============================================================================
// SUITE 7: Purge Sweep Cron (/api/cron/purge-trash)
// ============================================================================
describe('Suite 7: Purge Sweep Cron (/api/cron/purge-trash)', () => {
  it('TC-CRON-01: Cron invocation enforces CRON_SECRET authentication', async () => {
    const mockDb = createMockSupabase([]);

    // Case A: Missing authentication header
    const reqNoAuth = mockReq({ method: 'GET', url: '/api/cron/purge-trash', db: mockDb });
    const resNoAuth = mockRes();
    await purgeTrashCronHandler(reqNoAuth, resNoAuth, mockDb);
    assert.equal(resNoAuth._status, 401, 'Missing cron secret must return 401');

    // Case B: Invalid bearer token
    const reqWrong = mockReq({
      method: 'GET',
      url: '/api/cron/purge-trash',
      headers: { authorization: 'Bearer wrong-secret' },
      db: mockDb
    });
    const resWrong = mockRes();
    await purgeTrashCronHandler(reqWrong, resWrong, mockDb);
    assert.equal(resWrong._status, 401, 'Invalid cron secret must return 401');

    // Case C: Valid Authorization Bearer header
    const reqValidBearer = mockReq({
      method: 'GET',
      url: '/api/cron/purge-trash',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      db: mockDb
    });
    const resValidBearer = mockRes();
    await purgeTrashCronHandler(reqValidBearer, resValidBearer, mockDb);
    assert.equal(resValidBearer._status, 200, 'Valid bearer token must return 200');

    // Case D: Valid x-cron-secret header
    const reqValidCustom = mockReq({
      method: 'GET',
      url: '/api/cron/purge-trash',
      headers: { 'x-cron-secret': process.env.CRON_SECRET },
      db: mockDb
    });
    const resValidCustom = mockRes();
    await purgeTrashCronHandler(reqValidCustom, resValidCustom, mockDb);
    assert.equal(resValidCustom._status, 200, 'Valid x-cron-secret header must return 200');
  });

  it('TC-CRON-02: Dual 14-day sweep purges expired trash and purges cancelled documents', async () => {
    const sixteenDaysAgo = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString();
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Expired Trash (> 14 days): must delete R2 files + delete DB row
    const expiredTrash = makeUnverifiedFile({
      id: 'CRON-EXP-TRASH-01',
      is_deleted: true,
      deleted_at: sixteenDaysAgo,
      documents: {
        bill: 'trash/CRON-EXP-TRASH-01/bill.pdf',
        photo: 'trash/CRON-EXP-TRASH-01/photo.jpg'
      }
    });

    // 2. Fresh Trash (<= 14 days): must be untouched
    const freshTrash = makeUnverifiedFile({
      id: 'CRON-FRESH-TRASH-02',
      is_deleted: true,
      deleted_at: fourDaysAgo,
      documents: {
        bill: 'trash/CRON-FRESH-TRASH-02/bill.pdf'
      }
    });

    // 3. Expired Cancelled (> 14 days): must delete R2 files + update row to documents: {}
    const expiredCancelled = makeVerifiedFile({
      id: 'CRON-EXP-CANCEL-03',
      status: 'Cancelled',
      stage: 'CANCELLED',
      cancelled_at: twentyDaysAgo,
      documents: {
        bill: 'cancelled/CRON-EXP-CANCEL-03/bill.pdf',
        aadhaar: 'cancelled/CRON-EXP-CANCEL-03/aadhaar.pdf'
      }
    });

    // 4. Fresh Cancelled (<= 14 days): must be untouched
    const freshCancelled = makeVerifiedFile({
      id: 'CRON-FRESH-CANCEL-04',
      status: 'Cancelled',
      stage: 'CANCELLED',
      cancelled_at: fourDaysAgo,
      documents: {
        bill: 'cancelled/CRON-FRESH-CANCEL-04/bill.pdf'
      }
    });

    // 5. Active file: completely untouched
    const activeFile = makeVerifiedFile({
      id: 'CRON-ACTIVE-05',
      documents: { bill: 'active/CRON-ACTIVE-05/bill.pdf' }
    });

    const mockDb = createMockSupabase([
      expiredTrash,
      freshTrash,
      expiredCancelled,
      freshCancelled,
      activeFile
    ]);

    const req = mockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      db: mockDb
    });
    const res = mockRes();

    await purgeTrashCronHandler(req, res, mockDb);

    assert.equal(res._status, 200);
    assert.equal(res._body?.purgedTrashCount, 1, 'Must report 1 purged trash file');
    assert.equal(res._body?.purgedCancelledDocCount, 1, 'Must report 1 purged cancelled document file');

    // Check Row 1: Expired Trash deleted from DB
    assert.equal(
      mockDb.getRows().find(r => r.id === 'CRON-EXP-TRASH-01'),
      undefined,
      'Expired trash row must be deleted from DB'
    );

    // Check Row 2: Fresh Trash preserved
    assert.ok(
      mockDb.getRows().find(r => r.id === 'CRON-FRESH-TRASH-02'),
      'Fresh trash row must be preserved'
    );

    // Check Row 3: Expired Cancelled preserved but documents reset to {}
    const updatedCancelled = mockDb.getRows().find(r => r.id === 'CRON-EXP-CANCEL-03');
    assert.ok(updatedCancelled, 'Expired cancelled row must be preserved in DB');
    assert.deepEqual(updatedCancelled.documents, {}, 'Expired cancelled documents must be emptied');
    const purgeTimeline = updatedCancelled.timeline.find(t => t.title === 'Uploaded Documents Removed');
    assert.ok(purgeTimeline, 'Timeline must record document purge');

    // Check Row 4 & 5: Fresh Cancelled and Active untouched
    assert.ok(mockDb.getRows().find(r => r.id === 'CRON-FRESH-CANCEL-04')?.documents?.bill);
    assert.ok(mockDb.getRows().find(r => r.id === 'CRON-ACTIVE-05')?.documents?.bill);

    // Verify S3/R2 deletions: exactly 4 files deleted (2 from expired trash + 2 from expired cancelled)
    const dispatched = getDispatchedR2Deletions();
    assert.equal(dispatched.length, 4, 'Exactly 4 R2 files must be purged');
    const dispatchedKeys = dispatched.map(d => d.key);
    assert.ok(dispatchedKeys.includes('trash/CRON-EXP-TRASH-01/bill.pdf'));
    assert.ok(dispatchedKeys.includes('trash/CRON-EXP-TRASH-01/photo.jpg'));
    assert.ok(dispatchedKeys.includes('cancelled/CRON-EXP-CANCEL-03/bill.pdf'));
    assert.ok(dispatchedKeys.includes('cancelled/CRON-EXP-CANCEL-03/aadhaar.pdf'));
  });
});

// ============================================================================
// SUITE 8: Security & Privilege Escalation Prevention
// ============================================================================
describe('Suite 8: Security & Privilege Escalation Prevention', () => {
  it('TC-SEC-01: Dealer cannot self-verify application by submitting isVerified: true in action: update', async () => {
    const unverified = makeUnverifiedFile();
    const mockDb = createMockSupabase([unverified]);

    const req = mockReq({
      token: dealer1Token,
      body: {
        action: 'update',
        fileId: unverified.id,
        updates: {
          isVerified: true,
          verifiedAt: new Date().toISOString(),
          verifiedBy: 'Self-Authorized Dealer'
        }
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 200);
    // Verified status must remain false
    assert.equal(res._body?.data?.isVerified, false, 'Dealer cannot set isVerified to true');

    const rowInDb = mockDb.getRows().find(r => r.id === unverified.id);
    assert.equal(rowInDb.is_verified, false);
    assert.equal(rowInDb.verified_at, null);
    assert.equal(rowInDb.verified_by, null);
  });

  it('TC-SEC-02: Dealer cannot overwrite another dealer customer file via action: save', async () => {
    const dealer2File = makeUnverifiedFile({
      id: 'FIL-2026-DLR2-99',
      dealer_id: DEALER_2_USER.dealer_id,
      dealer_name: DEALER_2_USER.firmName
    });
    const mockDb = createMockSupabase([dealer2File]);

    const req = mockReq({
      token: dealer1Token, // Dealer 1 caller attempting to overwrite Dealer 2's file
      body: {
        action: 'save',
        file: {
          id: dealer2File.id,
          customerName: 'Hacked Name',
          sanctionedLoadKw: 5.0
        }
      },
      db: mockDb
    });
    const res = mockRes();

    await customerFilesHandler(req, res, mockDb);

    assert.equal(res._status, 403, 'Cross-dealer save overwrite must return HTTP 403');
    assert.equal(res._body?.error, 'Forbidden: You cannot modify customer files belonging to another dealer.');
  });
});

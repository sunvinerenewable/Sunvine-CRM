import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'sunvine-test-jwt-secret-min-32-chars-long-key!';
process.env.NODE_ENV = 'test';

import { requireUser, requireAdmin } from '../../../api/_lib/requireAuth.js';
import { signJwt } from '../../../api/_lib/jwt.js';
import { redisSet, redisDel } from '../../../api/_lib/redis.js';

function mockReq(token) {
  return {
    headers: {
      authorization: token ? `Bearer ${token}` : '',
      cookie: ''
    }
  };
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
  return res;
}

test('ITEM-2: requireUser returns 401 when no token is present', async () => {
  const req = mockReq(null);
  const res = mockRes();
  const user = await requireUser(req, res);

  assert.equal(user, null);
  assert.equal(res.statusCode, 401);
  assert.match(res.body?.error, /Authentication required/i);
});

test('ITEM-2: requireUser returns 401 when token is invalid or expired', async () => {
  const req = mockReq('invalid.garbage.token');
  const res = mockRes();
  const user = await requireUser(req, res);

  assert.equal(user, null);
  assert.equal(res.statusCode, 401);
  assert.match(res.body?.error, /Invalid or expired token/i);
});

test('ITEM-2: requireUser returns 403 when caller role does not match required roles', async () => {
  const token = signJwt({ id: 'DLR-101', role: 'dealer', dealer_id: 'DLR-101' });
  const req = mockReq(token);
  const res = mockRes();

  // Guard demanding admin or staff role
  const user = await requireUser(req, res, { roles: ['admin', 'staff'] });

  assert.equal(user, null);
  assert.equal(res.statusCode, 403);
  assert.match(res.body?.error, /Forbidden/i);
});

test('ITEM-2: requireUser rejects suspended account with 403 BEFORE handler side effects', async () => {
  const dealerId = 'DLR-SUSPENDED-99';
  const token = signJwt({ id: dealerId, role: 'dealer', dealer_id: dealerId });

  // Cache status as suspended in Redis
  await redisSet(`user:status:dealer:${dealerId}`, 'suspended', 60);

  let sideEffectRan = false;
  const req = mockReq(token);
  const res = mockRes();

  const user = await requireUser(req, res);
  if (user) {
    sideEffectRan = true;
  }

  assert.equal(user, null);
  assert.equal(sideEffectRan, false, 'Handler side effect must never run for suspended user');
  assert.equal(res.statusCode, 403);
  assert.match(res.body?.error, /Account suspended or inactive/i);

  await redisDel(`user:status:dealer:${dealerId}`);
});

test('ITEM-2: requireUser rejects inactive account with 403', async () => {
  const staffId = 'STF-INACTIVE-88';
  const token = signJwt({ id: staffId, role: 'staff', staff_id: staffId });

  await redisSet(`user:status:staff:${staffId}`, 'inactive', 60);

  const req = mockReq(token);
  const res = mockRes();

  const user = await requireUser(req, res);

  assert.equal(user, null);
  assert.equal(res.statusCode, 403);
  assert.match(res.body?.error, /Account suspended or inactive/i);

  await redisDel(`user:status:staff:${staffId}`);
});

test('ITEM-2: requireUser rejects deleted account (not_found) with 401', async () => {
  const adminId = 'ADM-DELETED-77';
  const token = signJwt({ id: adminId, role: 'admin', email: 'deleted@sunvine.in' });

  await redisSet(`user:status:admin:${adminId}`, 'not_found', 60);

  const req = mockReq(token);
  const res = mockRes();

  const user = await requireUser(req, res);

  assert.equal(user, null);
  assert.equal(res.statusCode, 401);
  assert.match(res.body?.error, /Account not found or deleted/i);

  await redisDel(`user:status:admin:${adminId}`);
});

test('ITEM-2: requireUser permits active account and returns payload', async () => {
  const dealerId = 'DLR-ACTIVE-11';
  const token = signJwt({ id: dealerId, role: 'dealer', dealer_id: dealerId });

  await redisSet(`user:status:dealer:${dealerId}`, 'active', 60);

  const req = mockReq(token);
  const res = mockRes();

  const user = await requireUser(req, res);

  assert.notEqual(user, null);
  assert.equal(user.id, dealerId);
  assert.equal(user.role, 'dealer');
  assert.equal(res.statusCode, null);

  await redisDel(`user:status:dealer:${dealerId}`);
});

test('ITEM-2: Static Codebase Audit: Every API handler file awaits requireUser or requireAdmin', () => {
  const apiDir = path.resolve('api');
  const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const fullPath = path.join(apiDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Skip helper directories or special public files
    if (file === 'catalog.js') continue; // Tested separately in Item 8

    const hasRequireUserCall = content.includes('requireUser(') || content.includes('requireAdmin(');
    if (hasRequireUserCall) {
      assert.match(
        content,
        /await\s+(requireUser|requireAdmin)\s*\(/,
        `File api/${file} must AWAIT requireUser or requireAdmin`
      );
    }
  }

  // Also check api/auth/[action].js and api/_lib/authManage.js
  const authActionContent = fs.readFileSync(path.resolve('api/auth/[action].js'), 'utf8');
  assert.match(authActionContent, /await\s+requireAdmin\s*\(/);

  const authManageContent = fs.readFileSync(path.resolve('api/_lib/authManage.js'), 'utf8');
  assert.match(authManageContent, /await\s+requireAdmin\s*\(/);
});

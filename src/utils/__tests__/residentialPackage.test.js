import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { handleResidentialPackage } from '../../../api/_lib/residentialPackage.js';

const id = '12345678-1234-1234-1234-123456789abc';

function call(action, data, role = 'admin') {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  return handleResidentialPackage(
    { method: 'POST', body: { action, ...data } },
    response,
    { id: 'admin-test', role }
  );
}

test('package actions require admin access', async () => {
  const response = await call('package-create', { id }, 'dealer');
  assert.equal(response.statusCode, 403);
});

test('package quote requires an explicit category', async () => {
  const response = await call('package-create', {
    id, customer_name: 'Package test', phone: '1234567890', address: 'Test address', city: 'Rajkot'
  });
  assert.equal(response.statusCode, 400);
});

test('package settings reject subsidy above either offer price', async () => {
  const response = await call('package-settings', {
    adani_price: 110512, waaree_price: 116854, central_subsidy: 80000,
    general_subsidy: 33600, sc_st_subsidy: 38960
  });
  assert.equal(response.statusCode, 400);
});

test('package quote creation snapshots approved database settings', async t => {
  const previous = process.env.DATABASE_URL;
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = '1';
  process.env.DATABASE_URL = 'postgresql://127.0.0.1:1/test';
  t.after(() => {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
  });
  const snapshot = { adani_price: 110512, central_subsidy: 62800, general_subsidy: 33600, discount: 1000 };
  const dbQuery = t.mock.method(pg.Pool.prototype, 'query', async (sql, params) => {
    assert.match(sql, /to_jsonb\(s\)/);
    assert.deepEqual(params, [id, 'admin-test', 'Package test', '1234567890', 'Test address', 'Rajkot', 'General / OBC', 1000]);
    return { rows: [{ id, snapshot }] };
  });
  const response = await call('package-create', {
    id, customer_name: 'Package test', phone: '1234567890', address: 'Test address',
    city: 'Rajkot', category: 'General / OBC', adani_price: 1, discount: 1000
  });
  assert.equal(response.statusCode, 200);
  assert.equal(dbQuery.mock.callCount(), 1);
  assert.equal(response.body.quote.snapshot.adani_price, 110512);
  assert.equal(response.body.quote.snapshot.discount, 1000);
});

import fs from 'fs';
import path from 'path';
import loginHandler from '../../api/auth/login.js';
import quotationHandler from '../../api/quotations.js';
import { signJwt } from '../../api/_lib/jwt.js';
import { getEnvConfig } from './db.mjs';

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    getHeader(k) {
      return this.headers[k.toLowerCase()];
    },
    json(obj) {
      this.body = obj;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runSmokeTests() {
  console.log('=== Local Smoke Test (Phase 4 Verification) ===\n');

  // Load config into process.env if needed
  const config = getEnvConfig();
  for (const [k, v] of Object.entries(config)) {
    if (v && !process.env[k]) {
      process.env[k] = v;
    }
  }

  // Ensure JWT secret is set
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${name}`);
      failed++;
    }
  }

  // ── Test 1: Authentication Gateway Validation ───────────────────────────
  console.log('1. Testing Authentication Gateway (api/auth/login.js)...');
  
  // 1a. Missing body fields
  {
    const req = { method: 'POST', body: {}, headers: { 'x-forwarded-for': '127.0.0.1' } };
    const res = mockRes();
    await loginHandler(req, res);
    assert(res.statusCode === 400, 'Rejects empty login payload with 400 Bad Request');
  }

  // 1b. Non-POST method
  {
    const req = { method: 'GET', headers: { 'x-forwarded-for': '127.0.0.1' } };
    const res = mockRes();
    await loginHandler(req, res);
    assert(res.statusCode === 405, 'Rejects GET request with 405 Method Not Allowed');
  }

  // 1c. Invalid credentials
  {
    const req = {
      method: 'POST',
      body: {
        identifier: 'nonexistent_user_99@example.com',
        password: 'RandomPassword123!',
        role: 'admin'
      },
      headers: { 'x-forwarded-for': '127.0.0.1' }
    };
    const res = mockRes();
    await loginHandler(req, res);
    assert(res.statusCode === 401, 'Rejects invalid credentials with 401 Unauthorized');
  }

  // ── Test 2: Quotations API Authorization ────────────────────────────────
  console.log('\n2. Testing Quotations API Authorization (api/quotations.js)...');
  
  // 2a. Unauthenticated save request rejected
  {
    const req = { method: 'POST', body: { action: 'save' }, headers: {} };
    const res = mockRes();
    await quotationHandler(req, res);
    assert(res.statusCode === 401, 'Rejects unauthenticated quotation mutation with 401');
  }

  // ── Test 3: Financial Recompute & Database Catalog Lookup ─────────────────
  console.log('\n3. Testing Server-Side Financial Recomputation with Live DB Catalog...');
  {
    // Generate valid dealer JWT with valid UUID
    const dealerToken = signJwt({
      id: 'b39ecb47-5093-400a-a67f-33b31bd5f314',
      role: 'dealer',
      dealer_id: 'b39ecb47-5093-400a-a67f-33b31bd5f314',
      dealer_code: 'DLR-TEST'
    });

    // Send intentionally manipulated pricing figures:
    // Client claims base_cost is ₹10 and total is ₹10!
    // Real DB has panel 'mod-aps-600' at ₹18.00/Wp and inverter 'inv-sunvine-3' at ₹29,800.
    const tamperedPayload = {
      action: 'save',
      system_capacity_kw: 3.0,
      panel_id: 'mod-aps-600',
      panel_watt: 600,
      inverter_id: 'inv-sunvine-3',
      bom_items: [
        { id: 'solar_panel', description: '600W Bifacial Solar Panels', qty: 5, rate: 10, total: 50 },
        { id: 'solar_inverter', description: '3.0 kW Inverter', qty: 1, rate: 10, total: 10 }
      ],
      // Tampered client numbers:
      base_cost: 60,
      dealer_margin: 999999, // Should be capped by tier
      total_amount: 60,
      subsidy_amount: 0,
      net_payable: 60,
      customer_state: 'Gujarat',
      customer_name: 'Test Customer Automated',
      customer_phone: '9876543210'
    };

    const req = {
      method: 'POST',
      body: tamperedPayload,
      headers: {
        cookie: `sunvine_auth_token=${dealerToken}`,
        'x-forwarded-for': '127.0.0.1'
      }
    };
    const res = mockRes();
    await quotationHandler(req, res);

    if (res.statusCode === 200 || res.statusCode === 201) {
      const q = res.body?.quotation;
      assert(q != null, 'Quotation returned quotation payload');
      
      const payload = q?.quote_payload;
      // Check that client's fake rate of ₹10 was replaced by DB rate (600W * 18.00 = 10,800)
      const panelItem = payload?.bomItems?.find(i => i.id === 'solar_panel');
      assert(panelItem?.rate === 10800, `Panel rate recomputed from DB catalog (expected 10800, got ${panelItem?.rate})`);

      // Check inverter rate replaced by DB rate (₹29,800)
      const invItem = payload?.bomItems?.find(i => i.id === 'solar_inverter');
      assert(invItem?.rate === 29800, `Inverter rate recomputed from DB catalog (expected 29800, got ${invItem?.rate})`);

      // Check subsidy for 3kW residential (₹78,000)
      assert(q?.subsidy_amount === 78000, `PM Surya Ghar subsidy correctly applied (expected 78000, got ${q?.subsidy_amount})`);

      // Check that total_amount is NOT the tampered 60
      assert(q?.total_amount > 50000, `Total amount server-recomputed (tampered 60 overridden, got ${q?.total_amount})`);

      // Check dealer margin cap enforced (default 6000/kW * 3kW = 18,000 max)
      assert(q?.dealer_margin <= 18000, `Dealer margin clamped to tier cap (expected <= 18000, got ${q?.dealer_margin})`);

      console.log(`\n  Financial Recomputation Verified:`);
      console.log(`    - DB Panel Rate: ₹${panelItem?.rate}/module`);
      console.log(`    - DB Inverter Rate: ₹${invItem?.rate}`);
      console.log(`    - Computed Base Cost: ₹${q?.base_cost}`);
      console.log(`    - Clamped Margin: ₹${q?.dealer_margin}`);
      console.log(`    - Total Amount: ₹${q?.total_amount}`);
      console.log(`    - Subsidy: ₹${q?.subsidy_amount}`);
      console.log(`    - Net Payable: ₹${q?.net_payable}`);
    } else {
      console.error('Quotation save error response:', res.statusCode, res.body);
      assert(false, `Quotation save handler returned status ${res.statusCode}`);
    }
  }

  console.log(`\n=== LOCAL SMOKE TEST SUMMARY ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch(err => {
  console.error('Smoke test exception:', err);
  process.exit(1);
});

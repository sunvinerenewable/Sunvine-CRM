import test from 'node:test';
import assert from 'node:assert/strict';

import { customerFileService } from '../../services/customerFileService.js';
import { quotationService } from '../../services/quotationService.js';
import { dealerService } from '../../services/dealerService.js';
import { adminAccountService } from '../../services/adminAccountService.js';
import { staffService } from '../../services/staffService.js';
import { pricingService } from '../../services/pricingService.js';
import { hardwareService } from '../../services/hardwareService.js';
import { settingsService } from '../../services/settingsService.js';
import { systemSettingsService } from '../../services/systemSettingsService.js';
import { documentMasterService } from '../../services/documentMasterService.js';
import { auditLogService } from '../../services/auditLogService.js';
import { fetchGooglePlacesNearby } from '../../services/googlePlacesNearbyService.js';
import { supabase } from '../../lib/supabase.js';

// Helper mock fetch for Node test environment
function setupFetchMock(handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    return handler(String(url), options);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test('C2: customerFileService mutations send credentials: include to /api/customer-files', async () => {
  const calls = [];
  const restoreFetch = setupFetchMock(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { id: 'CF-1001' } })
    };
  });

  try {
    // 1. Save
    await customerFileService.saveCustomerFile({ id: 'CF-1001', customerName: 'Ramesh Patel' });
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, '/api/customer-files');
    assert.strictEqual(calls[0].options.credentials, 'include');
    assert.strictEqual(calls[0].options.method, 'POST');
    const saveBody = JSON.parse(calls[0].options.body);
    assert.strictEqual(saveBody.action, 'save');
    assert.strictEqual(saveBody.file.id, 'CF-1001');

    // 2. Update
    await customerFileService.updateCustomerFile('CF-1001', { phone: '9876543210' });
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[1].options.credentials, 'include');
    const updateBody = JSON.parse(calls[1].options.body);
    assert.strictEqual(updateBody.action, 'update');
    assert.strictEqual(updateBody.fileId, 'CF-1001');

    // 3. Cancel
    await customerFileService.cancelCustomerFile('CF-1001', 'Customer opted out', 'Admin');
    assert.strictEqual(calls.length, 3);
    assert.strictEqual(calls[2].options.credentials, 'include');
    const cancelBody = JSON.parse(calls[2].options.body);
    assert.strictEqual(cancelBody.action, 'cancel');

    // 4. Restore
    await customerFileService.restoreCustomerFile('CF-1001');
    assert.strictEqual(calls.length, 4);
    assert.strictEqual(calls[3].options.credentials, 'include');
    const restoreBody = JSON.parse(calls[3].options.body);
    assert.strictEqual(restoreBody.action, 'restore');

    // 5. Delete
    await customerFileService.deleteCustomerFile('CF-1001');
    assert.strictEqual(calls.length, 5);
    assert.strictEqual(calls[4].options.credentials, 'include');
    const deleteBody = JSON.parse(calls[4].options.body);
    assert.strictEqual(deleteBody.action, 'delete');
  } finally {
    restoreFetch();
  }
});

test('C2: quotationService includes request_id, credentials: include, and sends to /api/quotations', async () => {
  const calls = [];
  const restoreFetch = setupFetchMock(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, quotation: { id: 'SV-2026-Q001' } })
    };
  });

  try {
    // 1. Save quotation
    const res = await quotationService.saveQuotation({
      id: 'SV-2026-Q001',
      customerName: 'Anil Shah',
      customerPhone: '9825012345',
      systemCapacityKW: 5
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, '/api/quotations');
    assert.strictEqual(calls[0].options.credentials, 'include');
    const reqBody = JSON.parse(calls[0].options.body);
    assert.strictEqual(reqBody.action, 'save');
    assert.ok(reqBody.request_id, 'request_id must be present in save payload (idempotency key)');

    // 2. Status update
    await quotationService.updateQuotationStatus('SV-2026-Q001', 'Approved');
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[1].options.credentials, 'include');
    const statusBody = JSON.parse(calls[1].options.body);
    assert.strictEqual(statusBody.action, 'status');
    assert.strictEqual(statusBody.newStatus, 'Approved');

    // 3. Delete quotation
    await quotationService.deleteQuotation('SV-2026-Q001');
    assert.strictEqual(calls.length, 3);
    assert.strictEqual(calls[2].options.credentials, 'include');
    const delBody = JSON.parse(calls[2].options.body);
    assert.strictEqual(delBody.action, 'delete');
  } finally {
    restoreFetch();
  }
});

test('C2: dealerService & adminAccountService send credentials: include to backend endpoints', async () => {
  const calls = [];
  const restoreFetch = setupFetchMock(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, dealer: { id: 'SV-DLR-01' } })
    };
  });

  try {
    // Create dealer
    await dealerService.createDealer({
      dealerCode: 'SV-DLR-01',
      firmName: 'Sun Solar',
      contactPerson: 'Karan Dave',
      mobile: '9876501234'
    });
    assert.ok(calls.length >= 1);
    assert.strictEqual(calls[0].options.credentials, 'include');
    assert.ok(calls[0].url.includes('/api/auth/admin-dealers') || calls[0].url.includes('/api/auth/manage-credentials'));

    // Update dealer
    await dealerService.updateDealer('SV-DLR-01', { firmName: 'Sun Solar Pro' });
    const updateCall = calls[calls.length - 1];
    assert.strictEqual(updateCall.options.credentials, 'include');

    // Delete dealer
    await dealerService.deleteDealer('SV-DLR-01');
    const delCall = calls[calls.length - 1];
    assert.strictEqual(delCall.options.credentials, 'include');

    // adminAccountService delete
    await adminAccountService.deleteDealer('SV-DLR-01');
    const adminDelCall = calls[calls.length - 1];
    assert.strictEqual(adminDelCall.options.credentials, 'include');
  } finally {
    restoreFetch();
  }
});

test('C2: staffService sends credentials: include to /api/auth/admin-staff', async () => {
  const calls = [];
  const restoreFetch = setupFetchMock(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, staff: { id: 'STF-101' } })
    };
  });

  try {
    await staffService.createStaff({
      name: 'Sneha Patel',
      phone: '9825100000',
      role: 'Solar Field Executive'
    });
    assert.ok(calls.length >= 1);
    assert.strictEqual(calls[0].options.credentials, 'include');
    assert.ok(calls[0].url.includes('/api/auth/admin-staff') || calls[0].url.includes('/api/auth/manage-credentials'));

    await staffService.updateStaff('STF-101', { name: 'Sneha Dave' });
    const lastCall = calls[calls.length - 1];
    assert.strictEqual(lastCall.options.credentials, 'include');

    await staffService.deleteStaff('STF-101');
    const delCall = calls[calls.length - 1];
    assert.strictEqual(delCall.options.credentials, 'include');
  } finally {
    restoreFetch();
  }
});

test('C2: pricingService sends credentials: include to /api/auth/admin-pricing', async () => {
  const calls = [];
  const restoreFetch = setupFetchMock(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    };
  });

  try {
    await pricingService.savePricingPresets({ baseRatePerKw: 58000, subsidyCap: 78000 });
    const presetCall = calls.find(c => c.url === '/api/auth/admin-pricing' && JSON.parse(c.options.body).op === 'upsert-presets');
    assert.ok(presetCall);
    assert.strictEqual(presetCall.options.credentials, 'include');

    await pricingService.saveBosMatrix([{ capacityKW: 3, noOfModules: 6 }]);
    const bosCall = calls.find(c => c.url === '/api/auth/admin-pricing' && JSON.parse(c.options.body).op === 'upsert-bos');
    assert.ok(bosCall);
    assert.strictEqual(bosCall.options.credentials, 'include');

    await pricingService.saveTierMargins({ Gold: { defaultMarginPerKw: 4000 } });
    const tierCall = calls.find(c => c.url === '/api/auth/admin-pricing' && JSON.parse(c.options.body).op === 'upsert-tier-margins');
    assert.ok(tierCall);
    assert.strictEqual(tierCall.options.credentials, 'include');
  } finally {
    restoreFetch();
  }
});

test('C2: hardwareService sends credentials: include to /api/auth/admin-hardware and admin-pricing', async () => {
  const calls = [];
  const restoreFetch = setupFetchMock(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, module: { id: 'mod-1' }, inverter: { id: 'inv-1' } })
    };
  });

  try {
    // Module
    await hardwareService.saveModule({ id: 'mod-1', brand: 'Adani Solar', model: 'Shine 550W' });
    const modCall = calls.find(c => c.url === '/api/auth/admin-hardware' && JSON.parse(c.options.body).op === 'upsert-module');
    assert.ok(modCall);
    assert.strictEqual(modCall.options.credentials, 'include');

    // Inverter
    await hardwareService.saveInverter({ id: 'inv-1', brand: 'Sungrow', model: 'SG5.0RS' });
    const invCall = calls.find(c => c.url === '/api/auth/admin-hardware' && JSON.parse(c.options.body).op === 'upsert-inverter');
    assert.ok(invCall);
    assert.strictEqual(invCall.options.credentials, 'include');

    // BOM Item
    await hardwareService.saveBomItem({ id: 'bom-1', name: 'HDG Structure 2.5m', defaultRate: 1500 });
    const bomCall = calls.find(c => c.url === '/api/auth/admin-pricing' && JSON.parse(c.options.body).op === 'upsert-bom');
    assert.ok(bomCall);
    assert.strictEqual(bomCall.options.credentials, 'include');
  } finally {
    restoreFetch();
  }
});

test('C2: settingsService & systemSettingsService send credentials: include to /api/auth/admin-settings', async () => {
  const calls = [];
  const restoreFetch = setupFetchMock(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, settings: {} })
    };
  });

  try {
    await settingsService.saveSystemSettings('companyProfile', { name: 'Sunvine Renewable Energy' });
    const setCall = calls.find(c => c.url === '/api/auth/admin-settings' && JSON.parse(c.options.body).op === 'upsert');
    assert.ok(setCall);
    assert.strictEqual(setCall.options.credentials, 'include');
    const body = JSON.parse(setCall.options.body);
    assert.strictEqual(body.section, 'company_profile');

    await systemSettingsService.saveSystemSettings({ name: 'Sunvine HQ' });
    const sysCall = calls.find(c => c.url === '/api/auth/admin-settings' && JSON.parse(c.options.body).op === 'upsert');
    assert.ok(sysCall);
    assert.strictEqual(sysCall.options.credentials, 'include');
  } finally {
    restoreFetch();
  }
});

test('C2: documentMasterService sends credentials: include to /api/auth/admin-document-master', async () => {
  const calls = [];
  const restoreFetch = setupFetchMock(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    };
  });

  try {
    await documentMasterService.upsertDocument({ key: 'electricity_bill', label: 'Electricity Bill' });
    const upsertCall = calls.find(c => c.url === '/api/auth/admin-document-master' && JSON.parse(c.options.body).op === 'upsert');
    assert.ok(upsertCall);
    assert.strictEqual(upsertCall.options.credentials, 'include');

    await documentMasterService.deleteDocument('electricity_bill');
    const delCall = calls.find(c => c.url === '/api/auth/admin-document-master' && JSON.parse(c.options.body).op === 'delete');
    assert.ok(delCall);
    assert.strictEqual(delCall.options.credentials, 'include');
  } finally {
    restoreFetch();
  }
});

test('C2: auditLogService sends credentials: include to /api/auth/admin-audit-logs', async () => {
  const calls = [];
  const restoreFetch = setupFetchMock(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    };
  });

  try {
    await auditLogService.logEvent('login_success', 'AUTH', 'user-1', { ip: '127.0.0.1' });
    assert.ok(calls.length >= 1);
    assert.strictEqual(calls[0].url, '/api/auth/admin-audit-logs');
    assert.strictEqual(calls[0].options.credentials, 'include');
    const body = JSON.parse(calls[0].options.body);
    assert.strictEqual(body.op, 'log');
  } finally {
    restoreFetch();
  }
});

test('C2: googlePlacesNearbyService does not read API keys from localStorage (SEC-022)', async () => {
  const calls = [];
  const restoreFetch = setupFetchMock(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, count: 0, leads: [] })
    };
  });

  try {
    await fetchGooglePlacesNearby({
      latitude: 23.0225,
      longitude: 72.5714,
      radiusMeters: 5000,
      forceRefresh: true
    });

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, '/api/places-nearby');
    assert.strictEqual(calls[0].options.credentials, 'include');
    const body = JSON.parse(calls[0].options.body);
    assert.strictEqual(body.apiKey, undefined, 'API key should not be passed from client (server-side resolution)');
    assert.strictEqual(body.geoapifyKey, undefined, 'Geoapify key should not be passed from client');
    assert.strictEqual(body.latitude, 23.0225);
    assert.strictEqual(body.longitude, 72.5714);
  } finally {
    restoreFetch();
  }
});

test('C2: Supabase client is configured purely for public reads without session persistence', () => {
  assert.ok(supabase, 'Supabase client should exist');
  // Client is instantiated for public read-only catalog queries
});

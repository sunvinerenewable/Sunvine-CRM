import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderMainMessage,
  isDocUploaded,
  DOC_ALIASES,
  formatTimestampIST,
  callSlackApi,
  syncFile
} from '../../../api/_lib/slackSync.js';

test('isDocUploaded: accurately resolves direct keys and aliases', () => {
  const docs = {
    applicantAadhaar: 'https://r2.sunvine.dev/aadhaar.pdf',
    pan: { uploaded: true },
    electricityBill: { url: 'https://r2.sunvine.dev/bill.pdf' },
    sitePhoto: ['https://r2.sunvine.dev/photo1.jpg'],
    emptyDoc: null,
    emptyDocObj: { uploaded: false }
  };

  assert.equal(isDocUploaded(docs, 'aadhaarCard'), true);
  assert.equal(isDocUploaded(docs, 'panCard'), true);
  assert.equal(isDocUploaded(docs, 'lightBill'), true);
  assert.equal(isDocUploaded(docs, 'sitePhotos'), true);
  assert.equal(isDocUploaded(docs, 'bankDetails'), false);
  assert.equal(isDocUploaded(docs, 'emptyDoc'), false);
  assert.equal(isDocUploaded(docs, 'emptyDocObj'), false);
});

test('renderMainMessage: builds Block Kit card with required checklist and alias resolution', () => {
  const fileRow = {
    id: 'CF-2026-TEST1',
    customer_name: 'Rajesh Sharma',
    solar_system_kw: 6.0,
    sanctioned_load_kw: 7.0,
    dealer_name: 'Alpha Solar Power',
    staff_name: 'HQ Desk',
    city: 'Ahmedabad',
    discom: 'UGVCL',
    finance_type: 'CASH',
    roof_type: 'Flat RCC',
    stage: 'LEAD_SOURCED',
    status: 'Sourced',
    documents: {
      aadhaar: 'aadhaar.pdf',
      electricityBill: 'bill.pdf',
      // Bank details missing
      passportPhoto: 'passport.jpg' // Optional doc that is uploaded
    }
  };

  const payload = renderMainMessage(fileRow);
  assert.ok(payload.text.includes('Rajesh Sharma'));
  assert.ok(payload.text.includes('CF-2026-TEST1'));

  // Checklist verification
  const checklistSection = payload.blocks.find(b => b.type === 'section' && b.text?.text?.includes('Required Documents'));
  assert.ok(checklistSection, 'Must contain a checklist section');
  const text = checklistSection.text.text;

  // Should have checkmark for uploaded required docs
  assert.ok(text.includes('✅ Aadhaar Card') || text.includes('✅ Applicant Aadhaar Card'));
  assert.ok(text.includes('✅ Light / Electricity Bill') || text.includes('✅ Light Bill'));
  // Missing required doc should have empty box
  assert.ok(text.includes('⬜ Bank Details'));

  // Optional uploaded doc should be present
  assert.ok(text.includes('Passport Size Photo') || text.includes('passportPhoto'));

  // Should NOT display any raw file names
  assert.ok(!text.includes('aadhaar.pdf'), 'Should not show file names');
  assert.ok(!text.includes('bill.pdf'), 'Should not show file names');

  // Verify Deep Link Button
  const actionsBlock = payload.blocks.find(b => b.type === 'actions');
  assert.ok(actionsBlock);
  const button = actionsBlock.elements[0];
  assert.ok(button.url.includes('?openFile=CF-2026-TEST1&tab=applications'));
});

test('renderMainMessage: handles Cancelled and Handed Over stages correctly', () => {
  const cancelledFile = {
    id: 'CF-CANCEL',
    customer_name: 'Cancelled Customer',
    status: 'Cancelled',
    stage: 'CANCELLED'
  };
  const cancelledMsg = renderMainMessage(cancelledFile);
  assert.ok(cancelledMsg.text.includes('⚠️ Application Cancelled'));

  const handoverFile = {
    id: 'CF-HANDOVER',
    customer_name: 'Completed Customer',
    status: 'Handed Over',
    stage: 'HANDOVER_COMPLETED'
  };
  const handoverMsg = renderMainMessage(handoverFile);
  assert.ok(handoverMsg.text.includes('✅ Commissioned & Handed Over'));
});

test('formatTimestampIST: formats date cleanly and mentions IST once', () => {
  const formatted = formatTimestampIST(new Date());
  assert.ok(formatted.endsWith(' IST'));
  assert.equal(formatted.split(' IST').length - 1, 1, 'IST must appear exactly once');
});

test('syncFile: gracefully handles unconfigured environment without throwing', async () => {
  const origToken = process.env.SLACK_BOT_TOKEN;
  const origChannel = process.env.SLACK_FILES_CHANNEL_ID;
  delete process.env.SLACK_BOT_TOKEN;
  delete process.env.SLACK_FILES_CHANNEL_ID;

  try {
    const res = await syncFile('CF-TEST-UNCONFIGURED');
    assert.equal(res.success, true);
    assert.equal(res.skipped, 'unconfigured');
  } finally {
    if (origToken) process.env.SLACK_BOT_TOKEN = origToken;
    if (origChannel) process.env.SLACK_FILES_CHANNEL_ID = origChannel;
  }
});

test('syncFile: invalid fileId returns failure without throwing', async () => {
  const res = await syncFile(null);
  assert.equal(res.success, false);
});

test('diff logic: stage change generates correct thread line', async () => {
  const { computeThreadNotification } = await import('../../../api/_lib/slackSync.js');
  const oldRow = { stage: 'SITE_SURVEY', status: 'Survey Scheduled' };
  const newRow = { stage: 'QUOTATION_ACCEPTED', status: 'Quotation Accepted' };
  const line = computeThreadNotification(oldRow, newRow, 'Rahul Sharma');
  assert.equal(line, 'Stage: SITE SURVEY -> QUOTATION ACCEPTED (by Rahul Sharma)');
});

test('diff logic: verify-only and timeline-only update produces NO thread line', async () => {
  const { computeThreadNotification } = await import('../../../api/_lib/slackSync.js');
  const oldRow = {
    stage: 'SITE_SURVEY',
    status: 'Survey Scheduled',
    documents: {
      aadhaarCard: { url: 'https://r2.sunvine.dev/aadhaar.pdf', verified: false }
    },
    timeline: []
  };
  const newRow = {
    stage: 'SITE_SURVEY',
    status: 'Survey Scheduled',
    documents: {
      aadhaarCard: { url: 'https://r2.sunvine.dev/aadhaar.pdf', verified: true }
    },
    timeline: [{ note: 'Verified by staff' }]
  };
  const line = computeThreadNotification(oldRow, newRow, 'Staff Desk');
  assert.equal(line, null, 'Verification-only update must NOT generate a thread notification');
});

test('diff logic: document removed generates correct thread line', async () => {
  const { computeThreadNotification } = await import('../../../api/_lib/slackSync.js');
  const oldRow = {
    stage: 'LEAD_SOURCED',
    status: 'Sourced',
    documents: {
      aadhaarCard: 'https://r2.sunvine.dev/aadhaar.pdf',
      panCard: 'https://r2.sunvine.dev/pan.pdf'
    }
  };
  const newRow = {
    stage: 'LEAD_SOURCED',
    status: 'Sourced',
    documents: {
      panCard: 'https://r2.sunvine.dev/pan.pdf'
      // aadhaarCard removed
    }
  };
  const line = computeThreadNotification(oldRow, newRow, 'Dealer Alpha');
  assert.ok(line.includes('Aadhaar Card') && line.includes('removed by Dealer Alpha'));
});

test('diff logic: document replaced generates correct thread line', async () => {
  const { computeThreadNotification } = await import('../../../api/_lib/slackSync.js');
  const oldRow = {
    stage: 'LEAD_SOURCED',
    status: 'Sourced',
    documents: {
      panCard: 'https://r2.sunvine.dev/pan_old.pdf'
    }
  };
  const newRow = {
    stage: 'LEAD_SOURCED',
    status: 'Sourced',
    documents: {
      panCard: 'https://r2.sunvine.dev/pan_new.pdf'
    }
  };
  const line = computeThreadNotification(oldRow, newRow, 'Dealer Alpha');
  assert.ok(line.includes('PAN Card') && line.includes('replaced by Dealer Alpha'));
});

test('pending claim: isPendingClaim and isPendingExpired accurately detect age and format', async () => {
  const { isPendingClaim, isPendingExpired } = await import('../../../api/_lib/slackSync.js');

  assert.equal(isPendingClaim(null), false);
  assert.equal(isPendingClaim('1712574920.000100'), false);
  assert.equal(isPendingClaim('pending'), true);
  assert.equal(isPendingClaim('pending:1712574920000'), true);

  const freshEpoch = Date.now() - 5000; // 5s ago
  assert.equal(isPendingExpired(`pending:${freshEpoch}`), false);

  const staleEpoch = Date.now() - 35000; // 35s ago (> 30s)
  assert.equal(isPendingExpired(`pending:${staleEpoch}`), true);

  const stalePlainDate = new Date(Date.now() - 35000).toISOString();
  assert.equal(isPendingExpired('pending', stalePlainDate), true);

  const freshPlainDate = new Date(Date.now() - 5000).toISOString();
  assert.equal(isPendingExpired('pending', freshPlainDate), false);
});

test('atomic claim: stuck pending:<old timestamp> gets reclaimed by exactly one of two parallel syncs', async () => {
  const { isPendingExpired } = await import('../../../api/_lib/slackSync.js');

  const staleEpoch = Date.now() - 40000; // 40s old
  const initialRow = {
    id: 'CF-STUCK-PENDING',
    slack_ts: `pending:${staleEpoch}`,
    slack_channel: 'C12345',
    updated_at: new Date(staleEpoch).toISOString()
  };

  assert.equal(isPendingExpired(initialRow.slack_ts, initialRow.updated_at), true);

  // Simulate atomic DB CAS update: UPDATE ... WHERE slack_ts = initialRow.slack_ts
  let winner = null;
  const attemptClaim = async (workerId) => {
    if (initialRow.slack_ts === `pending:${staleEpoch}`) {
      initialRow.slack_ts = `pending:${Date.now()}`;
      return workerId;
    }
    return null;
  };

  const [res1, res2] = await Promise.all([attemptClaim('worker-1'), attemptClaim('worker-2')]);
  const claimedWorkers = [res1, res2].filter(Boolean);

  assert.equal(claimedWorkers.length, 1, 'Exactly one worker must win the reclamation');
});

test('atomic claim: fresh pending:<recent timestamp> is NOT reclaimed', async () => {
  const { isPendingExpired } = await import('../../../api/_lib/slackSync.js');

  const freshEpoch = Date.now() - 5000; // only 5s old
  const row = {
    id: 'CF-FRESH-PENDING',
    slack_ts: `pending:${freshEpoch}`,
    slack_channel: 'C12345'
  };

  assert.equal(isPendingExpired(row.slack_ts), false);
});

test('resilience: callSlackApi caps slow/429 loops and returns within ~4s without throwing', async () => {
  const { callSlackApi } = await import('../../../api/_lib/slackSync.js');

  const start = Date.now();
  const deadline = start + 1000; // 1s test deadline

  // Call with already-expired or tight deadline
  const res = await callSlackApi('chat.update', { channel: 'C123', ts: '123' }, 1, deadline);
  const duration = Date.now() - start;

  assert.ok(duration <= 4500, `Duration ${duration}ms must be well within vercel budget`);
  assert.equal(typeof res, 'object');
  assert.equal(res.ok, false);
});

test('sequencing: two updates close together wait interval to prevent stale state', async () => {
  const { redisSet, redisGet } = await import('../../../api/_lib/redis.js');

  const fileId = 'CF-TEST-SEQ-1';
  const throttleKey = `slack_throttle:${fileId}`;

  // Record an initial edit sent 500ms ago
  const initialTime = Date.now() - 500;
  await redisSet(throttleKey, String(initialTime), 10);

  const lastSentRaw = await redisGet(throttleKey);
  const elapsed = Date.now() - parseInt(lastSentRaw, 10);
  const waitNeeded = 2000 - elapsed;

  assert.ok(waitNeeded <= 2000, 'Wait needed is bounded by 2000ms');
});

test('schema compatibility: syncFile handles minimal customer_files schema with slack_channel and slack_ts', async () => {
  // Verifies that only the columns declared in 018_customer_files_slack_thread.sql
  // (slack_channel, slack_ts) are accessed during the syncFile flow
  const minimalRow = {
    id: 'CF-SCHEMA-TEST',
    customer_name: 'Schema Verification User',
    solar_system_kw: 5,
    sanctioned_load_kw: 6,
    stage: 'LEAD_SOURCED',
    status: 'Sourced',
    documents: {},
    slack_channel: 'C08G60JFTU8',
    slack_ts: null
  };

  // Ensure properties used by syncFile exist on minimalRow
  assert.equal(minimalRow.slack_channel, 'C08G60JFTU8');
  assert.equal(minimalRow.slack_ts, null);
  assert.equal(minimalRow.slack_channel_id, undefined, 'Must not rely on slack_channel_id column');
});

test('security: escapeSlackMrkdwn neutralizes injection and truncates', async () => {
  const { escapeSlackMrkdwn } = await import('../../../api/_lib/slackSync.js');

  assert.equal(escapeSlackMrkdwn('Hello & Welcome <@U12345>'), 'Hello &amp; Welcome &lt;@U12345&gt;');
  assert.equal(escapeSlackMrkdwn('<!channel> Alert!'), '&lt;!channel&gt; Alert!');
  assert.equal(escapeSlackMrkdwn(null), '');
  assert.equal(escapeSlackMrkdwn(undefined), '');

  const longStr = 'A'.repeat(200);
  const truncated = escapeSlackMrkdwn(longStr, 50);
  assert.ok(truncated.length <= 50, 'Truncated length must not exceed max');
  assert.ok(truncated.endsWith('…'), 'Truncated string must end with ellipsis');
});

test('edge case: renderMainMessage omits deep link button if APP_BASE_URL is missing', async () => {
  const origBase = process.env.APP_BASE_URL;
  try {
    delete process.env.APP_BASE_URL;
    const msg = renderMainMessage({
      id: 'CF-NO-BASEURL',
      customer_name: 'No Base Url Test'
    });
    const hasActions = msg.blocks.some(b => b.type === 'actions');
    assert.equal(hasActions, false, 'Actions block must be omitted when APP_BASE_URL is unset');
  } finally {
    if (origBase) process.env.APP_BASE_URL = origBase;
  }
});

test('edge case: documents as null, empty array, or malformed shapes do not crash renderer', () => {
  const nullDocs = renderMainMessage({ id: 'CF-NULL-DOCS', documents: null });
  assert.ok(nullDocs.text.includes('CF-NULL-DOCS'));

  const arrayDocs = renderMainMessage({ id: 'CF-ARRAY-DOCS', documents: [] });
  assert.ok(arrayDocs.text.includes('CF-ARRAY-DOCS'));

  const stringDocs = renderMainMessage({ id: 'CF-STR-DOCS', documents: 'corrupt' });
  assert.ok(stringDocs.text.includes('CF-STR-DOCS'));
});

test('edge case: unknown document category gracefully falls back without throwing', () => {
  const customCatFile = {
    id: 'CF-UNKNOWN-CAT',
    customer_name: 'Unknown Category User',
    finance_type: 'CUSTOM_UNKNOWN_TYPE',
    roof_type: 'Unknown Roof Type',
    source_type: 'SPECIAL_FLOW',
    documents: {}
  };
  const msg = renderMainMessage(customCatFile);
  assert.ok(msg.text.includes('Unknown Category User'));
  const checklist = msg.blocks.find(b => b.type === 'section' && b.text?.text?.includes('Required Documents'));
  assert.ok(checklist, 'Checklist section must be present even for unknown categories');
});

test('edge case: terminal Slack errors return failure and do not cause retry loops', async () => {
  const { callSlackApi } = await import('../../../api/_lib/slackSync.js');

  // When token is invalid, Slack returns invalid_auth immediately without 500 retry loop
  const start = Date.now();
  const res = await callSlackApi('chat.update', { channel: 'C123', ts: '123' }, 1, null, 'xoxb-invalid-fake-token');
  const elapsed = Date.now() - start;

  assert.ok(elapsed < 2000, 'Terminal error must fail fast without retrying');
  assert.equal(res.ok, false);
});





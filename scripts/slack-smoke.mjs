// scripts/slack-smoke.mjs
// This script posts to the real Slack channel using SLACK_BOT_TOKEN and cleans up after itself via chat.delete.
// It touches NO database and NEVER prints tokens.

import { ensureEnvLoaded } from '../api/_lib/db.js';
import { callSlackApi, renderMainMessage } from '../api/_lib/slackSync.js';

ensureEnvLoaded();

const channel = process.env.SLACK_FILES_CHANNEL_ID;
const token = process.env.SLACK_BOT_TOKEN;

if (!token || !channel) {
  console.error('[slack-smoke] Missing SLACK_BOT_TOKEN or SLACK_FILES_CHANNEL_ID in .env');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const baseFile = {
  id: 'SMOKE-TEST-001',
  customer_name: 'Smoke Test Customer',
  solar_system_kw: 5.0,
  sanctioned_load_kw: 6.0,
  dealer_name: 'Smoke Test Dealer',
  staff_name: 'Direct HQ Desk',
  city: 'Ahmedabad',
  discom: 'UGVCL',
  finance_type: 'BANK_LOAN',
  roof_type: 'Flat RCC',
  stage: 'LEAD_SOURCED',
  status: 'Sourced',
  documents: {},
  updated_at: new Date().toISOString()
};

const createdMessages = []; // Track { ts, channel } for cleanup

async function runSmokeTest() {
  console.log('--- Starting Slack Live Smoke Test (No DB) ---');
  let mainTs = null;

  try {
    // Step 1: Post initial main message with empty checklist
    {
      const payload = renderMainMessage(baseFile);
      const res = await callSlackApi('chat.postMessage', {
        channel,
        text: payload.text,
        blocks: payload.blocks
      });
      const ok = Boolean(res?.ok && res?.ts);
      console.log(`Step 1 (Post main message): ok=${ok}${!ok ? ` error=${res?.error}` : ''}`);
      if (!ok) throw new Error(`Step 1 failed: ${res?.error}`);
      mainTs = res.ts;
      createdMessages.push({ ts: mainTs, channel });
    }

    await sleep(2000);

    // Step 2: Update with Aadhaar uploaded (✅)
    {
      baseFile.documents = {
        aadhaarCard: 'https://vault.sunvine.dev/aadhaar.pdf'
      };
      baseFile.updated_at = new Date().toISOString();
      const payload = renderMainMessage(baseFile);
      const res = await callSlackApi('chat.update', {
        channel,
        ts: mainTs,
        text: payload.text,
        blocks: payload.blocks
      });
      const ok = Boolean(res?.ok);
      console.log(`Step 2 (Update Aadhaar uploaded): ok=${ok}${!ok ? ` error=${res?.error}` : ''}`);
      if (!ok) throw new Error(`Step 2 failed: ${res?.error}`);
    }

    await sleep(2000);

    // Step 3: Update with Aadhaar ✅ + PAN ✅ + optional doc (passportPhoto)
    {
      baseFile.documents = {
        aadhaarCard: 'https://vault.sunvine.dev/aadhaar.pdf',
        panCard: 'https://vault.sunvine.dev/pan.pdf',
        passportPhoto: 'https://vault.sunvine.dev/photo.jpg'
      };
      baseFile.updated_at = new Date().toISOString();
      const payload = renderMainMessage(baseFile);
      const res = await callSlackApi('chat.update', {
        channel,
        ts: mainTs,
        text: payload.text,
        blocks: payload.blocks
      });
      const ok = Boolean(res?.ok);
      console.log(`Step 3 (Update Aadhaar + PAN + optional uploaded): ok=${ok}${!ok ? ` error=${res?.error}` : ''}`);
      if (!ok) throw new Error(`Step 3 failed: ${res?.error}`);
    }

    // Step 4: Post thread reply: Stage progressed
    {
      baseFile.stage = 'SITE_SURVEY';
      baseFile.status = 'Survey Scheduled';
      const threadText = 'Stage: LEAD SOURCED -> SITE SURVEY (by Smoke Test)';
      const res = await callSlackApi('chat.postMessage', {
        channel,
        thread_ts: mainTs,
        text: threadText
      });
      const ok = Boolean(res?.ok && res?.ts);
      console.log(`Step 4 (Thread reply - Stage change): ok=${ok}${!ok ? ` error=${res?.error}` : ''}`);
      if (ok) createdMessages.push({ ts: res.ts, channel });
    }

    // Step 5: Post thread reply (Aadhaar removed) and update card with Aadhaar back to ⬜
    {
      const threadText = 'Aadhaar Card removed by Smoke Test';
      const threadRes = await callSlackApi('chat.postMessage', {
        channel,
        thread_ts: mainTs,
        text: threadText
      });
      const threadOk = Boolean(threadRes?.ok && threadRes?.ts);
      if (threadOk) createdMessages.push({ ts: threadRes.ts, channel });

      delete baseFile.documents.aadhaarCard;
      baseFile.updated_at = new Date().toISOString();
      const payload = renderMainMessage(baseFile);
      const updateRes = await callSlackApi('chat.update', {
        channel,
        ts: mainTs,
        text: payload.text,
        blocks: payload.blocks
      });
      const ok = threadOk && Boolean(updateRes?.ok);
      console.log(`Step 5 (Doc removed thread + checklist ⬜): ok=${ok}${!ok ? ` error=${updateRes?.error || threadRes?.error}` : ''}`);
    }

    // Step 6: Update card to Cancelled header + thread line, then Restore + thread line
    {
      // 6a: Cancel
      baseFile.status = 'Cancelled';
      baseFile.stage = 'CANCELLED';
      baseFile.updated_at = new Date().toISOString();
      const cancelPayload = renderMainMessage(baseFile);
      const cancelUpdate = await callSlackApi('chat.update', {
        channel,
        ts: mainTs,
        text: cancelPayload.text,
        blocks: cancelPayload.blocks
      });
      const cancelThread = await callSlackApi('chat.postMessage', {
        channel,
        thread_ts: mainTs,
        text: 'Application Cancelled: Customer request (by Smoke Test)'
      });
      if (cancelThread?.ts) createdMessages.push({ ts: cancelThread.ts, channel });

      // 6b: Restore
      baseFile.status = 'Sourced';
      baseFile.stage = 'LEAD_SOURCED';
      baseFile.updated_at = new Date().toISOString();
      const restorePayload = renderMainMessage(baseFile);
      const restoreUpdate = await callSlackApi('chat.update', {
        channel,
        ts: mainTs,
        text: restorePayload.text,
        blocks: restorePayload.blocks
      });
      const restoreThread = await callSlackApi('chat.postMessage', {
        channel,
        thread_ts: mainTs,
        text: 'Application Restored to active pipeline by Smoke Test'
      });
      if (restoreThread?.ts) createdMessages.push({ ts: restoreThread.ts, channel });

      const ok = Boolean(cancelUpdate?.ok && cancelThread?.ok && restoreUpdate?.ok && restoreThread?.ok);
      console.log(`Step 6 (Cancel & Restore updates + threads): ok=${ok}`);
    }

    // Failure Mode Verification: call with invalid token in memory only
    {
      const originalToken = process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = 'xoxb-invalid-token-test';
      const start = Date.now();
      let threw = false;
      let failRes = null;
      try {
        failRes = await callSlackApi('chat.postMessage', {
          channel,
          text: 'Should not post'
        });
      } catch (_) {
        threw = true;
      } finally {
        process.env.SLACK_BOT_TOKEN = originalToken;
      }
      const elapsed = Date.now() - start;
      const ok = !threw && elapsed <= 4500 && (failRes?.ok === false || failRes?.error);
      console.log(`Failure Mode Check (Invalid token): ok=${ok} (threw=${threw}, duration=${elapsed}ms, error=${failRes?.error || 'none'})`);
    }

  } finally {
    // Step 7: Clean up all test messages
    console.log('--- Cleaning Up Test Messages ---');
    // Reverse order: delete thread replies before deleting parent message
    const toDelete = [...createdMessages].reverse();
    for (const msg of toDelete) {
      try {
        const delRes = await callSlackApi('chat.delete', {
          channel: msg.channel,
          ts: msg.ts
        });
        console.log(`Delete message ${msg.ts}: ok=${Boolean(delRes?.ok)}${delRes?.error ? ` (${delRes.error})` : ''}`);
      } catch (err) {
        console.warn(`Cleanup error for ${msg.ts}:`, err.message);
      }
    }
    console.log('--- Slack Live Smoke Test Complete ---');
  }
}

runSmokeTest().catch((err) => {
  console.error('[slack-smoke] Fatal smoke test error:', err.message);
  process.exit(1);
});

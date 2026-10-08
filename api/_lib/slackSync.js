/**
 * api/_lib/slackSync.js
 *
 * Sunvine Enterprise Slack Synchronization Engine
 * - Single message per customer file, updated in-place (chat.update)
 * - Thread replies strictly for stage changes, document deletions, and document replacements
 * - Atomic slack_ts reservation prevents duplicate top-level messages
 * - Graceful fallback: Slack failures NEVER break application operations
 */

import { createClient } from '@supabase/supabase-js';
import { ensureEnvLoaded } from './db.js';
import { redisGet, redisSet } from './redis.js';
import {
  DEFAULT_MASTER_DOCUMENT_REGISTRY,
  DEFAULT_CATEGORY_DOC_RULES,
  getDocumentSchemaKey
} from '../../src/data/defaultRequiredDocuments.js';

ensureEnvLoaded();

const SLACK_API_BASE = 'https://slack.com/api';
function getBotToken() { return process.env.SLACK_BOT_TOKEN; }
function getDefaultChannel() { return process.env.SLACK_FILES_CHANNEL_ID; }
function getAppBaseUrl() { return process.env.APP_BASE_URL; }
const CRASH_WEBHOOK_URL = process.env.SLACK_CRASH_WEBHOOK_URL;

// Document key alias dictionary for robust checklist lookup
export const DOC_ALIASES = {
  aadhaarCard: ['aadhaarCard', 'aadhaar', 'applicantAadhaar'],
  aadhaar: ['aadhaarCard', 'aadhaar', 'applicantAadhaar'],
  applicantAadhaar: ['aadhaarCard', 'aadhaar', 'applicantAadhaar'],

  panCard: ['panCard', 'pan', 'applicantPan'],
  pan: ['panCard', 'pan', 'applicantPan'],
  applicantPan: ['panCard', 'pan', 'applicantPan'],

  lightBill: ['lightBill', 'electricityBill'],
  electricityBill: ['lightBill', 'electricityBill'],

  bankDetails: ['bankDetails', 'bankPassbook', 'applicantBank'],
  bankPassbook: ['bankDetails', 'bankPassbook', 'applicantBank'],
  applicantBank: ['bankDetails', 'bankPassbook', 'applicantBank'],

  sitePhotos: ['sitePhotos', 'sitePhoto', 'rooftopPhoto'],
  sitePhoto: ['sitePhotos', 'sitePhoto', 'rooftopPhoto'],
  rooftopPhoto: ['sitePhotos', 'sitePhoto', 'rooftopPhoto'],

  veraBill: ['veraBill', 'propertyTax'],
  propertyTax: ['veraBill', 'propertyTax']
};

/**
 * Escape user-controlled strings for Slack mrkdwn to prevent formatting and mention injection
 * (&, <, > must be replaced with HTML entities)
 */
export function escapeSlackMrkdwn(text, maxLength = 3000) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  const escaped = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  if (escaped.length <= maxLength) return escaped;
  return escaped.slice(0, Math.max(0, maxLength - 1)) + '…';
}

/**
 * Compare old documents against new documents and determine removed/replaced document labels
 */
export function computeDocumentDiff(oldDocs = {}, newDocs = {}, registry = DEFAULT_MASTER_DOCUMENT_REGISTRY) {
  const getDocPathOrVal = (docVal) => {
    if (!docVal) return null;
    if (typeof docVal === 'string') return docVal.trim();
    if (Array.isArray(docVal)) return docVal.map(x => (typeof x === 'string' ? x : x?.url || x?.path)).filter(Boolean).join(',');
    if (typeof docVal === 'object') return docVal.url || docVal.path || (Array.isArray(docVal.files) ? docVal.files.join(',') : null) || (docVal.uploaded ? 'uploaded' : null);
    return null;
  };

  const getLabel = (key) => {
    const found = registry.find(r => r.key === key || r.alias === key);
    return found?.label || key;
  };

  const removed = [];
  const replaced = [];

  // Check all keys in oldDocs
  const allOldKeys = Object.keys(oldDocs || {});
  for (const key of allOldKeys) {
    const oldPath = getDocPathOrVal(oldDocs[key]);
    if (!oldPath) continue; // wasn't actually present/uploaded

    const newPath = getDocPathOrVal(newDocs?.[key]);
    const label = getLabel(key);

    if (!newPath) {
      removed.push(label);
    } else if (newPath !== oldPath) {
      replaced.push(label);
    }
  }

  return { removed: [...new Set(removed)], replaced: [...new Set(replaced)] };
}

/**
 * Determine thread notifications from old row vs new row diff
 */
export function computeThreadNotification(oldRow, newRow, actor = 'System Desk') {
  if (!oldRow || !newRow) return null;

  const safeActor = escapeSlackMrkdwn(actor, 100);

  // 1. Stage or Status changed
  const oldStage = oldRow.stage || oldRow.currentStage;
  const newStage = newRow.stage || newRow.currentStage;
  const oldStatus = oldRow.status;
  const newStatus = newRow.status;

  if (oldStage && newStage && oldStage !== newStage) {
    const fmtOld = escapeSlackMrkdwn(String(oldStage).replace(/_/g, ' '), 50);
    const fmtNew = escapeSlackMrkdwn(String(newStage).replace(/_/g, ' '), 50);
    return `Stage: ${fmtOld} -> ${fmtNew} (by ${safeActor})`;
  }

  if (oldStatus && newStatus && oldStatus !== newStatus) {
    const fmtOld = escapeSlackMrkdwn(oldStatus, 50);
    const fmtNew = escapeSlackMrkdwn(newStatus, 50);
    return `Status: ${fmtOld} -> ${fmtNew} (by ${safeActor})`;
  }

  // 2. Document removed or replaced
  const diff = computeDocumentDiff(oldRow.documents, newRow.documents);
  if (diff.removed.length > 0) {
    return `${escapeSlackMrkdwn(diff.removed.join(', '), 200)} removed by ${safeActor}`;
  }
  if (diff.replaced.length > 0) {
    return `${escapeSlackMrkdwn(diff.replaced.join(', '), 200)} replaced by ${safeActor}`;
  }

  // Pure verification/timeline/field edit -> No thread comment
  return null;
}

function getDbClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

/**
 * Format timestamp in IST (appends IST once)
 */
export function formatTimestampIST(date = new Date()) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) + ' IST';
}

/**
 * Resolve whether a document key or any of its aliases is marked uploaded
 */
export function isDocUploaded(documents, docKey, alias = null) {
  if (!documents || typeof documents !== 'object') return false;

  const candidateKeys = new Set([
    docKey,
    ...(alias ? [alias] : []),
    ...(DOC_ALIASES[docKey] || [])
  ]);

  for (const k of candidateKeys) {
    const val = documents[k];
    if (!val) continue;
    if (typeof val === 'string' && val.trim().length > 0) return true;
    if (Array.isArray(val) && val.length > 0) return true;
    if (typeof val === 'object') {
      if (val.uploaded === true) return true;
      if (val.url || val.path || (Array.isArray(val.files) && val.files.length > 0)) return true;
    }
  }
  return false;
}

/**
 * Fetch active document master rules from DB or fallback
 */
export async function getActiveDocRules(db) {
  try {
    const cached = await redisGet('cache:document_master_rules');
    if (cached) return cached;
  } catch (_) {}

  try {
    let rows = null;
    if (db) {
      const { data } = await db.from('document_master').select('*').order('created_at', { ascending: true });
      rows = data;
    }

    if (Array.isArray(rows) && rows.length > 0) {
      const registry = [];
      const rules = {
        RESIDENTIAL: {},
        BANK_LOAN: {},
        NBFC_LOAN: {},
        COMMERCIAL: {},
        HOUSING_SOCIETY: {}
      };

      rows.forEach(r => {
        registry.push({
          key: r.key,
          label: r.label || r.key,
          category: r.category || 'Applicant KYC',
          alias: r.alias || null
        });

        const rRules = typeof r.rules === 'object' && r.rules !== null
          ? r.rules
          : (typeof r.rules === 'string' ? JSON.parse(r.rules || '{}') : {});

        ['RESIDENTIAL', 'BANK_LOAN', 'NBFC_LOAN', 'COMMERCIAL', 'HOUSING_SOCIETY'].forEach(cat => {
          rules[cat][r.key] = rRules[cat] || DEFAULT_CATEGORY_DOC_RULES[cat]?.[r.key] || 'optional';
        });
      });

      const result = { registry, rules };
      try {
        await redisSet('cache:document_master_rules', result, 300);
      } catch (_) {}
      return result;
    }
  } catch (err) {
    console.warn('[slackSync] Document master DB lookup fallback:', err.message);
  }

  return {
    registry: DEFAULT_MASTER_DOCUMENT_REGISTRY,
    rules: DEFAULT_CATEGORY_DOC_RULES
  };
}

/**
 * Render Block Kit payload for the customer file's single top-level Slack card
 */
export function renderMainMessage(fileRow, docMasterData = null) {
  const f = fileRow || {};
  const fileId = escapeSlackMrkdwn(f.id || 'N/A', 50);
  const rawCustomerName = (f.customer_name || f.customerName || 'Customer').trim();
  const customerName = escapeSlackMrkdwn(rawCustomerName, 150);
  const solarKw = Number(f.solar_system_kw || f.solarSystemKw || 0);
  const sanctionedLoad = Number(f.sanctioned_load_kw || f.sanctionedLoadKw || solarKw);
  const dealerName = escapeSlackMrkdwn((f.dealer_name || f.dealerName || 'Authorized Dealer').trim(), 100);
  const staffName = escapeSlackMrkdwn((f.staff_name || f.staffName || 'HQ Desk').trim(), 100);
  const city = escapeSlackMrkdwn((f.city || 'Gujarat').trim(), 80);
  const discom = escapeSlackMrkdwn((f.discom || 'UGVCL').trim(), 50);
  const financeType = escapeSlackMrkdwn((f.finance_type || f.financeType || 'CASH').toUpperCase(), 40);
  const roofType = escapeSlackMrkdwn(f.roof_type || f.roofType || 'Flat RCC', 50);
  const stage = escapeSlackMrkdwn((f.stage || f.currentStage || 'LEAD_SOURCED').replace(/_/g, ' '), 50);
  const status = escapeSlackMrkdwn((f.status || 'Sourced').trim(), 50);

  const isCancelled = String(f.status || '').toLowerCase() === 'cancelled' ||
                      String(f.stage || f.currentStage || '').toUpperCase().includes('CANCELLED');
  const isHandedOver = String(f.stage || f.currentStage || '').toUpperCase().includes('HANDOVER');

  // Determine card header banner (Max 150 chars for plain_text header)
  let headerText = '⚡ Solar EPC Application';
  if (isCancelled) {
    headerText = '⚠️ Application Cancelled';
  } else if (isHandedOver) {
    headerText = '✅ Commissioned & Handed Over';
  }

  // Resolve schema category
  const schemaCat = getDocumentSchemaKey(f);
  const normalizedCat = schemaCat === 'FINANCE_LOAN' ? 'NBFC_LOAN' : (schemaCat === 'COMMON_METER' ? 'HOUSING_SOCIETY' : schemaCat);

  const registry = docMasterData?.registry || DEFAULT_MASTER_DOCUMENT_REGISTRY;
  const rules = docMasterData?.rules || DEFAULT_CATEGORY_DOC_RULES;
  const catRules = rules[schemaCat] || rules[normalizedCat] || {};

  const fileDocs = (f.documents && typeof f.documents === 'object' && !Array.isArray(f.documents)) ? f.documents : {};

  // Build checklist
  const requiredList = [];
  const optionalUploadedList = [];

  registry.forEach(doc => {
    const rule = catRules[doc.key] || 'optional';
    if (rule === 'disabled') return;

    const uploaded = isDocUploaded(fileDocs, doc.key, doc.alias);
    const label = escapeSlackMrkdwn(doc.label || doc.key, 80);

    if (rule === 'mandatory') {
      requiredList.push({ label, uploaded });
    } else if (uploaded) {
      // Optional docs listed ONLY if uploaded
      optionalUploadedList.push(label);
    }
  });

  const totalRequired = requiredList.length;
  const uploadedRequired = requiredList.filter(d => d.uploaded).length;

  let checklistMarkdown = '';
  if (totalRequired > 0) {
    const lines = requiredList.map(item => `${item.uploaded ? '✅' : '⬜'} ${item.label}`);
    checklistMarkdown = `*Required Documents (${uploadedRequired}/${totalRequired}):*\n` + lines.join('\n');
  } else {
    checklistMarkdown = '*Required Documents:* None required';
  }

  if (optionalUploadedList.length > 0) {
    checklistMarkdown += `\n\n*Uploaded Additional Docs:*\n` + optionalUploadedList.map(l => `📎 ${l}`).join('\n');
  }

  // Bound checklistMarkdown to 2800 chars (well under Slack 3000 limit)
  checklistMarkdown = escapeSlackMrkdwn(checklistMarkdown, 2800);

  const updatedTime = formatTimestampIST(f.updated_at || f.updatedAt || new Date());
  const baseUrl = getAppBaseUrl();

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: headerText.slice(0, 150),
        emoji: true
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Customer:* *${customerName}*\n*Capacity:* \`${solarKw} kW\` • *Sanctioned Load:* \`${sanctionedLoad} kW\`\n*Stage:* *${stage}* (${status})`
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `🤝 *Dealer Partner:*\n*${dealerName}*`
        },
        {
          type: 'mrkdwn',
          text: `🎯 *Assigned Staff:*\n*${staffName}*`
        },
        {
          type: 'mrkdwn',
          text: `📍 *Location & DISCOM:*\n*${city}* • \`${discom}\``
        },
        {
          type: 'mrkdwn',
          text: `💳 *Finance & Roof:*\n\`${financeType}\` • _${roofType}_`
        }
      ]
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: checklistMarkdown
      }
    }
  ];

  // Include deep-link button ONLY if valid APP_BASE_URL is configured
  if (baseUrl) {
    const deepLink = `${baseUrl.replace(/\/+$/, '')}/?openFile=${encodeURIComponent(f.id || '')}&tab=applications`;
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📂 Open Application',
            emoji: true
          },
          url: deepLink,
          action_id: `open_app_${String(f.id || '').replace(/[^a-zA-Z0-9_-]/g, '')}`
        }
      ]
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `📁 *File ID:* \`${fileId}\` • 🕒 _${updatedTime}_ • 🚀 *Sunvine Solar*`
      }
    ]
  });

  return {
    text: `${headerText}: ${customerName} (${fileId}) - ${solarKw} kW`.slice(0, 300),
    blocks
  };
}

// Errors where further retries against Slack are useless and will fail identically
const TERMINAL_SLACK_ERRORS = new Set([
  'channel_not_found',
  'not_in_channel',
  'is_archived',
  'invalid_auth',
  'account_inactive',
  'token_revoked',
  'restricted_action'
]);

/**
 * Execute HTTP call to Slack Web API with retry, 429 backoff handling, and deadline capping
 */
export async function callSlackApi(method, payload, attempt = 1, deadline = null, customToken = null) {
  const token = customToken || getBotToken();
  if (!token) return { ok: false, error: 'no_bot_token' };

  const now = Date.now();
  const effectiveDeadline = deadline || (now + 4000);
  const remainingMs = effectiveDeadline - now;

  if (remainingMs <= 100) {
    return { ok: false, error: 'slack_timeout_budget_exceeded' };
  }

  // Cap per-request timeout to remaining budget, max 3.5s
  const requestTimeout = Math.min(Math.max(remainingMs, 200), 3500);

  try {
    const res = await fetch(`${SLACK_API_BASE}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(requestTimeout)
    });

    if (res.status === 429) {
      const retryAfterSec = parseInt(res.headers.get('Retry-After') || '1', 10);
      const waitMs = Math.min(retryAfterSec * 1000, 1500);
      if (attempt <= 3 && (Date.now() + waitMs < effectiveDeadline)) {
        await new Promise(r => setTimeout(r, waitMs));
        return callSlackApi(method, payload, attempt + 1, effectiveDeadline, customToken);
      }
      return { ok: false, error: 'rate_limited_exhausted' };
    }

    if (!res.ok) {
      const backoffMs = attempt * 300;
      if (res.status >= 500 && attempt <= 3 && (Date.now() + backoffMs < effectiveDeadline)) {
        await new Promise(r => setTimeout(r, backoffMs));
        return callSlackApi(method, payload, attempt + 1, effectiveDeadline, customToken);
      }
      return { ok: false, error: `http_${res.status}` };
    }

    const json = await res.json();
    return json;
  } catch (err) {
    const backoffMs = attempt * 300;
    if (attempt <= 3 && (Date.now() + backoffMs < effectiveDeadline)) {
      await new Promise(r => setTimeout(r, backoffMs));
      return callSlackApi(method, payload, attempt + 1, effectiveDeadline, customToken);
    }
    return { ok: false, error: err.message };
  }
}

/**
 * Dispatch critical Slack failure alert to SLACK_CRASH_WEBHOOK_URL and write to audit_logs
 */
async function recordSlackFailure(db, fileId, reason, attempt = 1) {
  const safeReason = escapeSlackMrkdwn(String(reason), 300);
  console.error(`[slackSync] Slack sync failed for file ${fileId}:`, safeReason, `(Attempt: ${attempt})`);

  // Write audit log row to audit_logs (single source of truth table name)
  try {
    if (db) {
      await db.from('audit_logs').insert([{
        action: 'SLACK_SYNC_FAILED',
        entity_type: 'CUSTOMER_FILE',
        entity_id: fileId,
        actor_role: 'system',
        details: { reason: safeReason, attempt, timestamp: new Date().toISOString() }
      }]);
    }
  } catch (auditErr) {
    console.warn('[slackSync] Failed to insert audit_logs row for slack failure:', auditErr.message);
  }

  // Dispatch to crash webhook
  if (CRASH_WEBHOOK_URL) {
    try {
      await fetch(CRASH_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Slack Sync Failure for Customer File: \`${fileId}\`\n*Reason:* ${safeReason}`
        }),
        signal: AbortSignal.timeout(2000)
      }).catch(() => null);
    } catch (_) {}
  }
}

/**
 * Helper to determine if a slack_ts value represents a pending reservation
 */
export function isPendingClaim(slackTs) {
  if (!slackTs || typeof slackTs !== 'string') return false;
  return slackTs === 'pending' || slackTs.startsWith('pending:');
}

/**
 * Helper to determine if a pending reservation has expired (> 30s)
 */
export function isPendingExpired(slackTs, fileUpdatedAt = null) {
  if (!isPendingClaim(slackTs)) return false;
  const now = Date.now();
  if (slackTs.startsWith('pending:')) {
    const epochStr = slackTs.slice(8);
    const epoch = parseInt(epochStr, 10);
    if (!isNaN(epoch) && epoch > 0) {
      return (now - epoch) > 30000;
    }
  }
  // Fallback for legacy plain 'pending'
  if (fileUpdatedAt) {
    const updatedMs = new Date(fileUpdatedAt).getTime();
    if (!isNaN(updatedMs)) {
      return (now - updatedMs) > 30000;
    }
  }
  return true; // Malformed pending string is treated as expired
}

let loggedUnconfiguredOnce = false;

/**
 * Main synchronizer for customer file Slack integration.
 * Safe to call; NEVER throws exceptions to the caller.
 * Capped at ~4s total time to protect serverless responses.
 *
 * @param {string} fileId
 * @param {object} options
 * @param {string} [options.threadText] - If provided, posts as a thread comment under the main message
 * @param {string} [options.actor] - Caller actor label
 * @param {boolean} [options.force] - Force sync even if throttled
 * @param {object} [options.customDb] - Optional mock DB for testing
 */
export async function syncFile(fileId, { threadText = null, actor = null, force = false, customDb = null } = {}) {
  if (!fileId) return { success: false, reason: 'missing_file_id' };

  const token = getBotToken();
  const defaultChannel = getDefaultChannel();

  if (!token || !defaultChannel) {
    // Missing config: safe no-op with single console notice
    if (!loggedUnconfiguredOnce) {
      console.warn('[slackSync] Notice: SLACK_BOT_TOKEN or SLACK_FILES_CHANNEL_ID not configured. Skipping Slack sync.');
      loggedUnconfiguredOnce = true;
    }
    return { success: true, skipped: 'unconfigured' };
  }

  const startTime = Date.now();
  const deadline = startTime + 4000; // Hard 4-second total budget for Slack sync

  const db = customDb || getDbClient();
  if (!db) {
    return { success: false, reason: 'db_unavailable' };
  }

  try {
    const throttleKey = `slack_throttle:${fileId}`;

    // 1. Minimum ~2s interval check between edits (wait up to 3s if needed, then re-read fresh DB state)
    if (!force) {
      const lastSentRaw = await redisGet(throttleKey);
      if (lastSentRaw) {
        const lastSent = parseInt(lastSentRaw, 10);
        if (!isNaN(lastSent)) {
          const elapsed = Date.now() - lastSent;
          const waitNeeded = 2000 - elapsed;
          if (waitNeeded > 0) {
            // Check if we have budget to wait (max 3s and within 4s deadline)
            const allowedWait = Math.min(waitNeeded, 3000, Math.max(0, deadline - Date.now() - 500));
            if (allowedWait > 50) {
              await new Promise(r => setTimeout(r, allowedWait));
            } else if (Date.now() >= deadline - 200) {
              await recordSlackFailure(db, fileId, 'slack_timeout_budget_exceeded');
              return { success: false, reason: 'timeout_budget_exceeded' };
            }
          }
        }
      }
    }

    // 2. Fetch fresh DB row for the file (Always render from DB source of truth)
    const { data: fileRow, error: fetchErr } = await db
      .from('customer_files')
      .select('*')
      .eq('id', fileId)
      .maybeSingle();

    if (fetchErr || !fileRow) {
      return { success: false, reason: fetchErr?.message || 'file_not_found' };
    }

    const docRules = await getActiveDocRules(db);
    const mainMessagePayload = renderMainMessage(fileRow, docRules);

    let channel = fileRow.slack_channel || defaultChannel;
    let ts = fileRow.slack_ts;

    // 3. Case A: No slack_ts yet or expired pending claim -> Atomic reservation
    const isPending = isPendingClaim(ts);
    const isExpired = isPending && isPendingExpired(ts, fileRow.updated_at);

    if (!ts || isExpired) {
      const claimVal = `pending:${Date.now()}`;

      let claimQuery = db
        .from('customer_files')
        .update({
          slack_ts: claimVal,
          slack_channel: channel,
          updated_at: new Date().toISOString()
        })
        .eq('id', fileId);

      if (!ts) {
        claimQuery = claimQuery.is('slack_ts', null);
      } else {
        // Reclaiming expired pending reservation
        claimQuery = claimQuery.eq('slack_ts', ts);
      }

      const { data: claimed, error: claimErr } = await claimQuery.select('id').maybeSingle();

      if (claimed && !claimErr) {
        // We won the claim! Post the main message
        const postRes = await callSlackApi('chat.postMessage', {
          channel,
          text: mainMessagePayload.text,
          blocks: mainMessagePayload.blocks
        }, 1, deadline);

        if (postRes?.ok && postRes.ts) {
          ts = postRes.ts;
          channel = postRes.channel || channel;

          // Save final real ts to DB
          await db
            .from('customer_files')
            .update({ slack_ts: ts, slack_channel: channel })
            .eq('id', fileId);

          await redisSet(throttleKey, String(Date.now()), 10);
        } else {
          // Release pending lock so next event can self-heal
          await db
            .from('customer_files')
            .update({ slack_ts: null })
            .eq('id', fileId);

          await recordSlackFailure(db, fileId, postRes?.error || 'post_failed');
          return { success: false, error: postRes?.error };
        }
      } else {
        // Lost claim; re-read latest row
        const { data: rechecked } = await db.from('customer_files').select('slack_ts, slack_channel').eq('id', fileId).maybeSingle();
        ts = rechecked?.slack_ts;
        channel = rechecked?.slack_channel || channel;
      }
    } else if (isPending && !isExpired) {
      // Currently claimed by an active ongoing sync (< 30s old)
      return { success: true, waiting_on_claim: true };
    }

    // 4. Case B: Existing main message -> update in place (chat.update)
    // CRITICAL: NEVER call chat.update with a 'pending...' string!
    if (ts && !isPendingClaim(ts)) {
      if (Date.now() >= deadline - 200) {
        await recordSlackFailure(db, fileId, 'slack_timeout_budget_exceeded');
        return { success: false, reason: 'timeout_budget_exceeded' };
      }

      const updateRes = await callSlackApi('chat.update', {
        channel,
        ts,
        text: mainMessagePayload.text,
        blocks: mainMessagePayload.blocks
      }, 1, deadline);

      if (!updateRes?.ok) {
        // Handle message_not_found: recreate once
        if (updateRes?.error === 'message_not_found') {
          console.warn(`[slackSync] Message ${ts} not found for ${fileId}. Recreating main card...`);
          const recreateRes = await callSlackApi('chat.postMessage', {
            channel,
            text: mainMessagePayload.text,
            blocks: mainMessagePayload.blocks
          }, 1, deadline);

          if (recreateRes?.ok && recreateRes.ts) {
            ts = recreateRes.ts;
            await db
              .from('customer_files')
              .update({ slack_ts: ts, slack_channel: channel })
              .eq('id', fileId);
            await redisSet(throttleKey, String(Date.now()), 10);
          } else {
            await recordSlackFailure(db, fileId, recreateRes?.error || 'recreate_failed');
          }
        } else if (TERMINAL_SLACK_ERRORS.has(updateRes?.error)) {
          // Terminal error: log once, do not retry
          await recordSlackFailure(db, fileId, `terminal_${updateRes.error}`);
          return { success: false, error: updateRes.error };
        } else {
          await recordSlackFailure(db, fileId, updateRes?.error || 'update_failed');
        }
      } else {
        await redisSet(throttleKey, String(Date.now()), 10);
      }
    }

    // 5. Post Thread Reply if threadText is requested and we have a valid real ts
    if (threadText && ts && !isPendingClaim(ts)) {
      if (Date.now() < deadline - 200) {
        const safeThreadText = escapeSlackMrkdwn(threadText, 3000);
        await callSlackApi('chat.postMessage', {
          channel,
          thread_ts: ts,
          text: safeThreadText
        }, 1, deadline);
      }
    }

    return { success: true, ts, channel };
  } catch (fatalErr) {
    await recordSlackFailure(db, fileId, fatalErr.message);
    return { success: false, error: fatalErr.message };
  }
}

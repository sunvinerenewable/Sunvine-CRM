# Slack Thread Sync Architecture & Execution Plan

## 1. Files to Create / Modify / Delete

| Action | File | Reason |
| :--- | :--- | :--- |
| **CREATE** | `supabase/migrations/018_customer_files_slack_thread.sql` | Idempotent migration adding `slack_channel text` and `slack_ts text` columns to `customer_files`. |
| **MODIFY** | `supabase/schema_current.sql` | Maintain reference schema parity by adding `slack_channel text` and `slack_ts text` to `customer_files` definition. |
| **MODIFY** | `.env.example` | Document non-`VITE_` server variables: `SLACK_BOT_TOKEN`, `SLACK_FILES_CHANNEL_ID`, `APP_BASE_URL`. |
| **CREATE** | `api/_lib/slackSync.js` | Server-side Slack Web API sync module: render Block Kit message, fetch doc master rules, atomic claim, rate limiting/lock, thread posting, error handling/retries/audit alert. |
| **MODIFY** | `api/customer-files.js` | Hook `syncFile` into `save`, `update`, `cancel`, and `restore` mutations; calculate diff for thread comments; await execution without failing HTTP response. |
| **MODIFY** | `src/services/pushNotificationService.js` | Remove all calls to `slackNotificationService` while keeping W3C Web Push functionality 100% intact. |
| **MODIFY** | `api/push-notify.js` | Remove `slack-raw` action, `sendSlackNotification`, and computed Slack payloads; keep only Web Push. |
| **DELETE** | `src/services/slackNotificationService.js` | Deprecate and remove redundant client-side Slack webhook service. |
| **MODIFY** | `src/utils/__tests__/a2-files-storage-push.test.js` | Clean up removed `push-notify` Slack assertions and fix pre-existing intruder dealer 403 test mock so test suite is clean. |
| **CREATE** | `src/utils/__tests__/slack-sync.test.js` | Unit tests for Block Kit rendering, alias resolution, atomic claim concurrency, and failure resilience. |

---

## 2. Event -> Behavior Matrix

| Flow / Event | Trigger Location | Behavior | Thread Reply Line | Main Message Update |
| :--- | :--- | :--- | :--- | :--- |
| **Application Created** (Dealer, Staff, Admin) | `api/customer-files.js` (`action === 'save'`) | Atomic claim (`slack_ts = 'pending'`), posts top-level message with Block Kit card, stores returned `slack_ts` and `slack_channel`. | None | Initial post created in channel |
| **Stage / Status Changed** | `api/customer-files.js` (`action === 'update'`) | Detects change: `oldRow.stage !== newRow.stage` or `oldRow.status !== newRow.status`. Updates main card; posts thread reply. | `"Stage: {oldStage} -> {newStage} (by {actor})"` or `"Status: {oldStatus} -> {newStatus} (by {actor})"` | Status & stage pills updated |
| **Document Uploaded (Camera / File Picker)** | `api/customer-files.js` (`action === 'update'`) | New document key populated or status changed to uploaded. Silently updates main checklist. | None | Checklist item marked ✅ |
| **Document Verified** | `api/customer-files.js` (`action === 'update'`) | Document verification status changed. Silently updates main message. (Does NOT trigger stage thread line unless stage changed). | None | Main card checklist updated |
| **Document Removed** | `api/customer-files.js` (`action === 'update'`) | A document key that previously existed is now deleted/empty in `documents`. Updates main checklist; posts thread line. | `"{docLabel} removed by {actor}"` | Checklist item marked ⬜ |
| **Document Replaced** | `api/customer-files.js` (`action === 'update'`) | Document path/url changed for an existing key. Updates main checklist; posts thread line. | `"{docLabel} replaced by {actor}"` | Silent checklist update |
| **File / Consumer Edits** (kW, Address, Discom, etc.) | `api/customer-files.js` (`action === 'update'`) | Capacity, discom, dealer attribution, customer details modified. Updates main card silently. | None | Main card header & fields updated |
| **Application Cancelled** | `api/customer-files.js` (`action === 'cancel'`) | Status becomes Cancelled. Header changes to `⚠️ Cancelled`. Updates main message and posts thread line. | `"Application Cancelled: {reason} (by {actor})"` | Header: `⚠️ Application Cancelled` |
| **Application Restored** | `api/customer-files.js` (`action === 'restore'`) | Status returns to Sourced/Active. Header changes to active pipeline. Updates main message and posts thread line. | `"Application Restored to active pipeline (by {actor})"` | Header restored to active pipeline |

---

## 3. Required-Docs Checklist on Server & Import Architecture

### Server Import Decision
- In this repository, server functions in `api/` run as ES Modules (`"type": "module"` in `package.json`).
- `api/quotations.js` already successfully imports directly from `../src/shared/pricing/calculations.js` and `../src/data/standardBomData.js`.
- Vercel Serverless Function bundling supports relative imports across `api/` and `src/`.
- We import `DEFAULT_MASTER_DOCUMENT_REGISTRY`, `DEFAULT_CATEGORY_DOC_RULES`, and `getDocumentSchemaKey` directly from `../src/data/defaultRequiredDocuments.js` into `api/_lib/slackSync.js`.

### Dynamic Rules & Document Key Aliases
1. **Dynamic DB Rules (`document_master`)**:
   - `slackSync.js` queries `document_master` (with a 5-minute redis/cache-aside fallback to avoid querying on every send). If the table is unavailable or empty, it falls back to `DEFAULT_MASTER_DOCUMENT_REGISTRY` and `DEFAULT_CATEGORY_DOC_RULES`.
2. **Schema & Category Resolution**:
   - Schema key resolved using `getDocumentSchemaKey(fileRow)` (`RESIDENTIAL`, `BANK_LOAN`, `FINANCE_LOAN`, `COMMERCIAL`, `COMMON_METER`).
3. **Alias Mapping Engine**:
   - Document keys are normalized through canonical aliases:
     - Aadhaar: `aadhaarCard` / `aadhaar` / `applicantAadhaar`
     - Bank: `bankDetails` / `bankPassbook` / `applicantBank`
     - Light Bill: `lightBill` / `electricityBill`
     - PAN: `panCard` / `pan` / `applicantPan`
     - Site Photo: `sitePhotos` / `sitePhoto` / `rooftopPhoto`
     - Vera Bill: `veraBill` / `propertyTax`
4. **Checklist Display**:
   - Displays required checklist items formatted as:
     - `✅ {docLabel}` (if present and uploaded)
     - `⬜ {docLabel}` (if missing/not uploaded)
     - Summary count: `(n/m required)`
   - Optional documents are displayed **ONLY IF uploaded** (e.g., `📎 {docLabel} (Optional)`).
   - **NO individual filenames** are shown in Slack messages.

---

## 4. Guaranteeing "Never Two Main Messages" & Slack Resilience

### Atomic `slack_ts` Claim
```sql
UPDATE public.customer_files
SET slack_ts = 'pending', slack_channel = $2, updated_at = NOW()
WHERE id = $1 AND (slack_ts IS NULL OR (slack_ts = 'pending' AND updated_at < NOW() - INTERVAL '60 seconds'))
RETURNING id;
```
- Only the query that successfully matches and updates a row from `NULL` (or stuck `pending` > 60s) receives the lock.
- The winner calls `chat.postMessage` against Slack Web API.
- Upon success, it updates `customer_files` with the real `slack_ts` returned by Slack.
- If the winner fails, it resets `slack_ts` to `NULL` so subsequent requests can retry.
- All competing concurrent executions see `slack_ts IS NOT NULL` (or `'pending'`), skip `chat.postMessage`, and perform an update via `chat.update` once `slack_ts` is finalized.

### Rate Limiting & Throttling
- Per-file lock key: `slack_lock:${fileId}` in Upstash Redis (or in-memory Map fallback).
- Minimum 10-second interval between `chat.update` calls for the same file (`slack_last_sent:${fileId}`).
- If an update arrives within 10s, it marks `slack_pending:${fileId} = true`.

### Failure Isolation & Alerting
- All Slack calls in `customer-files.js` are wrapped in `try/catch` and executed without blocking customer file mutations. A Slack timeout or error **never** bubbles up or affects the HTTP 200 response to the client.
- **HTTP 429**: Parse `Retry-After` header and back off.
- **5xx / Network Errors**: Retry up to 3 times with exponential backoff (500ms, 1500ms, 3000ms).
- **`message_not_found`**: If Slack returns `message_not_found` on `chat.update`, clear `slack_ts` in DB, recreate the main message once, and log a warning.
- **Terminal Failure**:
  1. `console.error('[slackSync] Terminal failure for file:', fileId, err)`.
  2. Insert an audit log row into `audit_log` (`action: 'SLACK_SYNC_FAILED'`).
  3. Dispatch an error alert payload to `SLACK_CRASH_WEBHOOK_URL` if configured.

---

## 5. Test List & Verification Strategy

### Automated Tests
1. `npm test` running Node.js test runner:
   - `src/utils/__tests__/slack-sync.test.js`:
     - Checklist rendering with all aliases (`aadhaarCard`, `lightBill`, `panCard`, etc.).
     - Optional documents included only when uploaded.
     - Atomic claim concurrency: simulate 2 parallel syncs on the same fileId -> exactly 1 top-level post, 1 update.
     - Slack network failure / 429 / 5xx handling: verify `syncFile` resolves gracefully and never throws.
     - `message_not_found` recovery creates a new message and updates DB `slack_ts`.
   - `src/utils/__tests__/a2-files-storage-push.test.js`:
     - Verify updated push-notify tests pass without Slack dependencies.
2. Build Verification:
   - `npm run build` must succeed with 0 errors and output client bundle cleanly.

---

## 6. Risks & Limitations

1. **Serverless Execution Lifecycles**:
   - Vercel serverless functions freeze execution immediately after `res.json()`.
   - Resolution: `await syncFile(...)` must be completed before `res.status(200).json(...)`, but wrapped in `try/catch` so errors cannot disrupt the API response.
2. **Missing Live Credentials in Local Dev**:
   - In environments where `SLACK_BOT_TOKEN` or `SLACK_FILES_CHANNEL_ID` is not yet configured, `slackSync.js` safely no-ops with a single debug warning, allowing local offline development and automated tests without errors.

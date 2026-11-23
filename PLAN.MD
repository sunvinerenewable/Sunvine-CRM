# plan.md: Sunvine Dealer Portal, Pre-Launch Fix Plan

> **Source of truth for findings:** `PRE_LAUNCH_AUDIT.md` (IDs: SEC-001..029, HC-01..18, BUG-xx).
> **Goal:** take the verdict from NO-GO to GO by fixing every Critical/High issue, the launch-blocking hardcoded values, and the infra gaps, in a safe order.
> **Executor:** Claude Code (agent) + the human owner. Tasks marked 🧑 are **human-only**; tasks marked 🤖 are for the agent.

---

## 0. How Claude Code must use this file

1. Read `PRE_LAUNCH_AUDIT.md`, `AGENTS.md` and this file fully before touching anything.
2. Work **one task at a time, in order**. Tick the checkbox (`- [x]`) in this file when a task is done and its acceptance check passes.
3. **One commit per task**, message format: `fix(<finding-id>): <short summary>` (e.g. `fix(SEC-001): require admin JWT on manage-credentials`).
4. **Stop at every GATE.** Print a short status summary and wait for the human to say `continue`. Do not start the next phase on your own.
5. After every task run `npm run build` and `npm test`. A task is not done if either fails.
6. If a task's assumption turns out wrong (file moved, function differs, finding doesn't reproduce), **stop, explain, and ask**. Do not improvise a different design.

### Hard guardrails (apply to every phase)

- **Never** run SQL against, or connect to, a production database. Agent writes SQL files only; 🧑 runs them (first on staging).
- **Never** print, log or commit a secret. Mask as `abcd…wxyz`. Never create or edit any `.env*` file other than `.env.example` (placeholders only).
- **Never** push to `main`. Never force-push. Never rewrite git history.
- Do not touch: `src/data/gujaratDatabase.js`, CSS/layout/styling, PDF visual templates, `package-lock.json` (except via `npm audit fix` in its own task), existing migrations `001`-`009`.
- No new dependencies unless a task says so.
- Database-first rule (AGENTS.md): no new hardcoded business values. If a number/text is business data, it goes in the DB.
- New migrations start at `010_` and must be **idempotent** (`IF NOT EXISTS`, guarded `DROP`).
- Vercel function limit: `api/` already has 12 function files. **Do not add new top-level files in `api/`** without checking decision D2 below. Files under `api/_lib/` are not functions and are fine.

### Decisions the human must make first (record answers here)

| ID | Question | Answer |
|---|---|---|
| D0 | Which branch does Vercel build for **production**? Fix branch merges into main via PR by the owner. | `main` — production branch = main; all security work is based on origin/main; feature commits 5ca6cf7, 23578d3, 32914a6 (admin live DB feed) stay OUT of the hotfix and will be reviewed and merged separately after the security phases. |
| D1 | Can dealers add **custom BOM line items** (not in `bom_catalog`)? Decides how strict SEC-006 can be. | _(blank — agent will stop and ask when needed)_ |
| D2 | Vercel plan (Hobby = max 12 functions, Pro = more)? | _(blank — agent will stop and ask when needed)_ |
| D3 | Is the Supabase project in the local `.env` (host `wyb….co`) **production**? | _(blank — agent will stop and ask when needed)_ |
| D4 | Is a staging Supabase project + Vercel preview available (or will you create one)? | _(blank — agent will stop and ask when needed)_ |
| D5 | Max dealer discount allowed (% of gross turnkey)? Used for `governance_settings.max_discount_pct`. | _(blank — agent will stop and ask when needed)_ |

> Agent: if any of D0-D5 is blank when you reach a task that depends on it, stop and ask.

---

## 1. Overview

| Phase | What | Who | Est. | Gate |
|---|---|---|---|---|
| 0 | Emergency hotfix, backup, secret rotation, dashboard hardening | 🧑 + 🤖 | 3-4 h | G0 |
| 1 | API authorization and pricing-integrity fixes | 🤖 | 1 day | G1 |
| 2 | Browser writes → API, RLS lockdown SQL, password reset | 🤖 + 🧑 | 1 day | G2 |
| 3 | Hardcoded values → database | 🤖 | 0.5-1 day | G3 |
| 4 | Headers, Docker, CI, PWA, repo hygiene | 🤖 | 0.5 day | G4 |
| 5 | Auth hardening, idempotency, scale, monitoring, data cleanup, UI QA | 🤖 + 🧑 | 1-1.5 days | G5 |
| 6 | Re-verification, go/no-go, soft launch | 🧑 + 🤖 | 0.5 day | G6 |

Realistic total: **4-5 working days** for one engineer plus the agent. Do not skip gates to hit a date.

---

## Phase 0: Emergency hotfix (live system is exposed)

### T0.1 🧑 Confirm environment facts
- [ ] Answer D0, D2, D3, D4 above.
- [ ] Take a full `pg_dump` of the database (keep it outside the repo). Verify the file is non-empty.

### T0.2 🤖 SEC-001: lock down `manage-credentials`
Files: `api/_lib/authManage.js`, `api/auth/[action].js`, new `api/_lib/requireAuth.js`, new `api/_lib/cors.js`.
- [x] Create `api/_lib/cors.js`: `applyCors(req, res)` reads `ALLOWED_ORIGINS` (comma-separated env). Only echo `Access-Control-Allow-Origin` (with `Vary: Origin` and `Allow-Credentials: true`) when the request origin is in the list. No wildcard fallback.
- [x] Create `api/_lib/requireAuth.js` exporting `requireAdmin(req, res)`: reads token from cookie `sunvine_auth_token` or `Authorization: Bearer`, calls `verifyJwt` from `./jwt.js`, requires `payload.role === 'admin'`; otherwise sends 401/403 and returns `null`.
- [x] In `authManage.js`: replace the reflective CORS (lines ~13-34) with `applyCors`; call `requireAdmin` after the OPTIONS/method check and before the `switch (action)`.
- [x] Remove the `'admin123'` default (line ~454). `create-admin` and password updates require `password.length >= 10`, else 422.
- [x] Find every client caller of `manage-credentials` (`git grep -n "manage-credentials" src`). Ensure each uses `credentials: 'include'` so the admin UI still works.
- [x] Add `ALLOWED_ORIGINS` to `.env.example` (placeholder value only).
- [x] Test (`node:test`, put in `src/utils/__tests__/`): no token → 401/403; dealer token → 403; admin token → proceeds.

**Acceptance:** `git grep -n "admin123"` returns nothing; tests pass; build passes.

### T0.3 🤖 SEC-003: remove the login backdoor path
Files: `src/services/authService.js` (lines ~138-200), new `supabase/migrations/010_drop_verify_user_credentials.sql`.
- [x] Remove the `verify_user_credentials` RPC fallback and the client-side bcrypt fallback from `authService.js`. Login must go only through `/api/auth/login`.
- [x] Write `010_drop_verify_user_credentials.sql`: first a read-only check (`SELECT proname, prosrc ~ 'p_password\s*=' AS has_hardcoded_pw FROM pg_proc WHERE proname='verify_user_credentials';`), then `DROP FUNCTION IF EXISTS public.verify_user_credentials(text,text,text);` (do not execute).
- [x] Do not re-introduce any literal password in any file. Confirm with `git grep -nE "p_password\s*="`.

**Acceptance:** login still works via the API in a local run; build and tests pass.

### T0.4 🧑 Run the Phase 0 SQL and rotate secrets
- [ ] Run the check + drop from `010_...sql` on the live DB (after the dump from T0.1).
- [ ] Rotate in this order: DB password → `SUPABASE_SERVICE_ROLE_KEY` → R2 keys → VAPID private key → Upstash token → Gemini key → **`JWT_SECRET` last** (this logs everyone out).
  - If you rotate Supabase's legacy JWT secret, the anon key changes too: update `VITE_SUPABASE_ANON_KEY` and **rebuild** the bundle.
- [ ] Update all values in Vercel env, set `ALLOWED_ORIGINS`, confirm `NODE_ENV=production`, then redeploy once.
- [ ] Restrict Google Maps/Places/Geoapify keys by HTTP referrer and API in their consoles.

### T0.5 🧑 Supabase dashboard hardening (not covered by code)
- [ ] Authentication → disable **email/signup providers** you don't use (`/auth/v1/signup` is reachable with the anon key). Re-test with the probe afterwards.
- [ ] Storage → confirm every bucket holding customer documents is **private**; check no public listing.
- [ ] Database → Network restrictions / SSL enforced if available; remove unused DB roles and API keys.
- [ ] Cloudflare R2 → confirm bucket is private, no public access URL, CORS restricted to your domain. Upstash → confirm token scope.

### T0.6 🤖 SEC-004: neutralise the dangerous migration now
- [x] `git rm supabase_realtime_pricing_migration.sql` and remove the `migrate` script from `package.json` (and `scripts/run_migrations.js` if it only runs that file). Do this **now**, before anyone runs `npm run migrate` on production.
- [ ] If that migration was already applied anywhere, note it for T2.4 (policies + realtime publication must be dropped).

### GATE G0
- [ ] `curl -X POST <deployed>/api/auth/manage-credentials` with no token returns 401/403.
- [ ] Old DB password and old service-role key no longer work.
- [ ] Admin can still log in and the dealer/staff list loads.
- [ ] Signups disabled; buckets private; the realtime migration file is gone from the branch.

---

## Phase 1: API authorization and pricing integrity (work on staging)

> Branch: `fix/prelaunch-security`. Use the staging project (D4). All tests in this phase are against staging or mocks.

### T1.1 🤖 SEC-010: push endpoints
Files: `api/push-subscription.js`, `api/push-notify.js`.
- [ ] Require a valid JWT on both. Take `userId`/`role` **from the token**, ignore the body values.
- [ ] `push-notify` allowed for admin/staff only. Use `applyCors` from T0.2.
- [ ] Test: unauthenticated → 401; dealer calling `push-notify` → 403.

### T1.2 🤖 SEC-005: quotation overwrite (IDOR)
File: `api/quotations.js` (save handler, lines ~237-274).
- [ ] If `body.quotation_id` is supplied, load the existing row. 404 if missing. For `role==='dealer'`: 403 if `dealer_id` differs, 409 unless status is `Draft` or `Rejected`.
- [ ] For dealers, ignore any `dealer_id` in the body; always use the token's `dealer_id`.
- [ ] Test: dealer A cannot overwrite dealer B's quotation id.

### T1.3 🤖 SEC-006: server-side pricing integrity
File: `api/quotations.js` (lines ~165-202).
- [ ] Price **every** BOM line server-side from `bom_catalog` by id. GST comes from the catalogue row, not the client. Clamp `qty` to 0..10000. Clamp `rate` to the catalogue `min_rate`/`max_rate` if present.
- [ ] Unknown ids: if D1 = "no custom lines" → reject with 422. If D1 = "custom lines allowed" → accept only with a whitelisted `custom: true` flag, `gstRate` from an allowed set, and cap total custom value (value from `governance_settings`).
- [ ] `discount_amount`: clamp to `governance_settings.max_discount_pct` (D5) of gross turnkey. **If the setting is missing, allow 0 discount** (fail closed).
- [ ] Require `panel_id` for kit quotes.
- [ ] Tests: discount `1e9` is clamped; fake item id `panel_x` rate 1 gst 0 is rejected/clamped; honest 5.5 kW example still totals Rs 173,700 gross-with-margin and Rs 95,700 net (see audit Phase 4).

### T1.4 🤖 SEC-011: customer files ownership
File: `api/customer-files.js`.
- [ ] For `role==='dealer'`, add `.eq('dealer_id', jwt.dealer_id)` to every get/update/cancel/restore/delete query.
- [ ] Strip `dealer_id` from `updates` unless role is admin.
- [ ] Test: dealer B cannot update/cancel/restore dealer A's file.

### T1.5 🤖 SEC-009: storage endpoints
Files: `api/storage-download.js`, `api/storage-delete.js`, `api/storage-presign.js`.
- [ ] Remove the `isDev` / `NODE_ENV !== 'production'` bypass everywhere (fail closed).
- [ ] Ignore the client-supplied `bucket`; use the configured bucket only.
- [ ] **New uploads:** prefix keys with `${role}/${ownerId}/`.
- [ ] **Existing files (old `uploads/<name>` keys):** authorize download/delete by looking the key up in `customer_files` (dealer must own the record; staff/admin allowed). Do not break old files.
- [ ] In presign, stop deleting same-name alternate-extension objects belonging to someone else.
- [ ] Test: dealer cannot download or delete another dealer's key.

### T1.6 🤖 SEC-019 + BUG-02: audit trail and quotation ids
- [ ] `api/quotations.js:~288`: write to `audit_logs` with its real columns (see `supabase/migrations/009_audit_logs_comprehensive_schema_and_rls.sql`). Log insert failures to `console.error` (no PII), don't swallow silently.
- [ ] `generateQuotationId`: if the `next_quotation_seq` RPC fails, return a 500 error instead of a random hex id.

### T1.7 🤖 Tests for the whole phase
- [ ] Add tests listed above under `src/utils/__tests__/` (mock the db layer; do not connect to a real DB).

### GATE G1
- [ ] `npm run build` OK, `npm test` OK (including new tests).
- [ ] 🧑 Manual on staging: dealer creates a quote with and without a custom BOM line (per D1), PDF generates, second dealer cannot see or edit it, file upload/download works for old and new files.

---

## Phase 2: Move browser writes to the API and lock down RLS

### T2.1 🤖 Admin API handlers (SEC-008)
- [ ] Per D2: on **Pro** add `api/admin/[resource].js`; on **Hobby** add `admin-*` actions to the existing dynamic route `api/auth/[action].js` (no new top-level file).
- [ ] Resources (all behind `requireAdmin`, method-restricted, JSON-validated, generic error messages, service-role client from `api/_lib/db.js`): dealers, staff, pricing (presets, BOS matrix, BOM catalog, `dealer_custom_pricing`, tier margins), hardware (`solar_modules`, `solar_inverters`), `system_settings`, `document_master`, audit logs (read).
- [ ] On every admin save that changes rates/settings, delete the matching Redis keys (e.g. `dealer:rates:<id>`, catalogue keys).

### T2.2 🤖 Rewrite client services
Files: `src/services/{dealerService,staffService,pricingService,hardwareService,settingsService,systemSettingsService,documentMasterService,auditLogService,customerFileService,quotationService}.js`.
- [ ] Every write and every read of accounts/quotations/customer files uses `fetch('/api/...', { credentials: 'include' })`.
- [ ] `supabase-js` stays only for **read-only catalogue SELECT**.
- [ ] Delete the `quotationService.js:47,96` anon `select('*')` fallback (BUG-03).
- [ ] Replace `select('*')` on `dealer_accounts`/`staff_accounts` with API calls that never return `password_hash` or `access_code`.

**Acceptance:** `git grep -nE "supabase\s*\.\s*(from|rpc)\([^)]*\)\s*\.(upsert|insert|update|delete)" -- src` returns nothing.

### T2.3 🤖 Client auth state and fallbacks (SEC-014, SEC-023, HC-16)
File: `src/context/AppContext.jsx`.
- [ ] Hydrate `role`/auth from `/api/auth/verify` on mount; treat `localStorage` as a UI hint only.
- [ ] Remove `DEFAULT_STAFF`, `DEFAULT_CUSTOMER_FILES`, `DEFAULT_NOTIFICATIONS` and the price/preset fallbacks. On load failure show a **blocking "data unavailable" state**, never default prices.

### T2.4 🤖 RLS lockdown SQL (write only)
File: new `supabase/migrations/011_rls_lockdown_v2.sql`. Idempotent. Must:
- [ ] Drop all `USING (true)` / `WITH CHECK (true)` policies **except** `service_role` ones, then **re-create read-only `SELECT` policies for `anon` on catalogue tables only** (`solar_modules`, `solar_inverters`, `bom_catalog`, `bos_pricing_matrix`, `pricing_presets`, `document_master`, `inverter_benchmark_matrix`) and only on non-cost columns/views if cost columns exist.
- [ ] `REVOKE ALL` from `anon, authenticated` on `dealer_accounts, staff_accounts, admin_accounts, audit_logs, otp_verifications, customer_files, notifications, push_subscriptions, quotations, quotation_bom_snapshots, system_settings, dealer_custom_pricing`. (Settings the browser needs are served by `/api/catalog`.)
- [ ] `REVOKE INSERT, UPDATE, DELETE` on all catalogue tables from `anon, authenticated`.
- [ ] Drop policy `public_read_by_share_token` on `quotations` (public proposals are served by `/api/quotations?action=public`; confirm that handler uses the service role).
- [ ] Repoint `api/quotations.js:~150` from the `dealers` view to `dealer_accounts`, then `DROP VIEW IF EXISTS public.dealers, public.admin_users, public.staff_users;`.
- [ ] Remove pricing tables from the realtime publication (guarded `ALTER PUBLICATION supabase_realtime DROP TABLE ...`).
- [ ] `ENABLE ROW LEVEL SECURITY` on every public table.
- [ ] Header comment: "take a pg_dump first; apply only after the matching code is deployed".

### T2.5 🤖 Probe and password-reset scripts
- [ ] Extend `scripts/rollout/verify-anon-lockdown.mjs` into the post-fix probe: with the anon key, request count-only on every table/view above; **pass = 401 or 0 rows** for all sensitive tables; catalogue tables return rows but INSERT/UPDATE are denied; `rpc/verify_user_credentials` returns 404/permission denied. Never print row values.
- [ ] Write `scripts/rollout/force-password-reset.mjs` (does not execute by itself): generates random one-time passwords, writes bcrypt hashes for all dealers/staff, rotates staff `access_code`, and writes the plaintext list to a **gitignored** file `.local/reset-credentials.csv`. Add `.local/` to `.gitignore`. Print only counts to the terminal.

### T2.6 🧑 Staging run, then production runbook
- [ ] Apply `011_rls_lockdown_v2.sql` on **staging**, run the probe, smoke test: admin edits a dealer margin → dealer's next quote uses it; create quote + PDF; upload a customer file; hard refresh keeps data.
- [ ] Production, **in this order**: deploy code → run `011` SQL immediately after → run the probe → run `force-password-reset.mjs` → distribute new credentials securely.

### GATE G2
- [ ] Probe passes on production (sensitive tables 401/empty).
- [ ] Admin and dealer flows work end to end.
- [ ] All dealer/staff passwords reset and access codes rotated.

---

## Phase 3: Hardcoded values → database

### T3.1 🤖 Seed migration
File: new `supabase/migrations/012_governance_defaults.sql` (idempotent, do not execute).
- [ ] Extend `system_settings` JSON: `statutory_taxes.subsidy` `{slab1Rate:30000, slab2Rate:18000, cap:78000, breakpointKw:3}`; `governance_settings` `{max_discount_pct (D5), max_system_kw, quote_prefix, validity_days, default_specific_yield, default_tariff, default_loan_rate, upload_max_mb}`; `company_profile` `{whatsapp, helpdesk, website, state}`.
- [ ] `ALTER TABLE staff_accounts ADD COLUMN IF NOT EXISTS is_verification boolean NOT NULL DEFAULT false;`
- [ ] `CREATE TABLE IF NOT EXISTS solar_banks (...)` with RLS enabled and no anon policies.
- [ ] 🧑 Apply on staging, then production **before** deploying the code that reads these values.

### T3.2 🤖 Serve settings through the API
- [ ] Extend `api/catalog.js` (existing `cacheAside` pattern, 6 h TTL) to return the settings above. Admin saves invalidate the keys (T2.1).

### T3.3 🤖 Replace literals (launch-blocking set)
Remove fallbacks; if a required setting is missing, **throw/return an error, don't default**.
- [ ] HC-03 tier margins: `DealerManagement.jsx`, `PricingMaster.jsx:1986`, `AppContext.jsx:663`, `authLogin.js` (`|| 6000`), `quotations.js:~144`, `calculations.js:190`, `AllQuotations.jsx:1014,1167`. Source: `dealer_custom_pricing` only.
- [ ] HC-04 subsidy: `calculations.js:22-47` takes params from settings; `AllQuotations.jsx:312,1165` uses the **stored** `subsidy_amount`, never its own `60000 : 78000` fallback.
- [ ] HC-05 / HC-18 / HC-09: GST from `bom_catalog`, discount cap and max kW from settings, remove `|| 100` default rate (`AppContext.jsx:1266`).
- [ ] HC-08 / HC-16: remove kit-preset, benchmark-inverter and mock-data fallbacks (already blocked in T2.3; finish any remaining).
- [ ] HC-12 / SEC-013: replace `STF-800`/`STF-003` magic ids in `authLogin.js` with `staff_accounts.is_verification`.
- [ ] HC-13: no default passwords anywhere (verify).

### T3.4 🤖 Tests
- [ ] Unit tests: subsidy and margin come from injected settings; a missing setting throws; AllQuotations shows the stored subsidy.

**Acceptance:**
`git grep -nE "\b(6000|78000|4500|6500|5500|1440)\b" -- src api ':!src/utils/__tests__' ':!src/data/gujaratDatabase.js'` returns only comments/test constants. Changing a value in `system_settings` changes the next quotation without a redeploy.

### T3.5 🤖 Non-blocking hardcodes (do after launch if time is short)
- [ ] HC-01/02/06/10 company profile, bank, terms, WhatsApp/helpdesk (`defaultPresets.js`, `QuotationPreview.jsx:533`, `PricingMaster.jsx:328`) → read from `system_settings`; keep neutral placeholders only.
- [ ] HC-07/11/17 yield, tariff, loan rate, quote prefix, upload limits.
- [ ] HC-14 `solar_banks`; HC-15 `ref_locations` (post-launch).
- [ ] Duplicate sources of truth: `solar_inverters.base_price` (VARCHAR) vs `base_price_inr` (numeric), `solar_modules.rate_per_wp` vs `rate_per_wp_inr`. Pick the numeric column, make the API read only that one, backfill, then drop the VARCHAR column in a later migration.
- [ ] Rule: T3.5 may slip past launch day only if the T3.3 grep is clean and company profile/bank/terms are verified correct in `system_settings` (they already exist in the DB).

### GATE G3
- [ ] Build/tests pass, the grep above is clean, 🧑 staging smoke test of a full quotation with changed settings.

---

## Phase 4: Headers, infra, CI, repo hygiene

### T4.1 🤖 SEC-016: CSP and headers
- [ ] `vercel.json`: keep the existing HSTS/nosniff/XFO/Referrer/Permissions headers. Add the CSP from the audit (SEC-016) first as **Report-Only** on a preview, record violations (html2pdf, three, tesseract, Maps), adjust, then switch to enforcing `Content-Security-Policy`. Keep `'unsafe-eval'` only if a library needs it, and document which.
- [ ] Add `Cache-Control: no-store` for `/api/(.*)`.
- [ ] `nginx.conf.template`: add the same headers with `always`, repeat them inside the static-asset `location`, `index.html` no-store.

### T4.2 🤖 SEC-025: Docker and CI
- [ ] `Dockerfile`: `nginxinc/nginx-unprivileged:alpine`, `npm ci` only. `.dockerignore`: add `.env*`, `*.md`, `supabase`, `scripts`, `.git*`. Note in README that the Docker image has no `/api`.
- [ ] `.github/workflows/ci.yml`: add `npm audit --omit=dev --audit-level=high`, a gitleaks step, pin actions to commit SHAs.

### T4.3 🤖 SEC-017: DB TLS and pooler
- [ ] `api/_lib/db.js` and `scripts/run_migrations.js`: `ssl: { ca: process.env.PG_CA, rejectUnauthorized: true }` when `PG_CA` is set. Pool `max: 3`. Document `PG_CA` and the transaction pooler (port 6543) in `.env.example` (placeholders).

### T4.4 🤖 SEC-020: PWA weight
- [ ] `vite.config.js`: exclude `png|jpg|woff2` and the `three`/`pdf` chunks from the precache (`globIgnores`). Keep the offline app shell. `/api` must stay uncached.
- [ ] Subset the Material Symbols font (or replace with a small SVG icon set). Convert `sunvine_quotation_cover.png` to WebP ≤ 300 kB.

### T4.5 🤖 SEC-021: repo hygiene
- [ ] `git rm --cached` `AUDIT_REPORT.md`, `AUDIT_REPORT_V2.md`, `Sunvine_Merged_Audit_Report.md`, `HARDWARE_AUDIT_REPORT.md`, `PRICING_AND_DB_AUDIT_REPORT.md`, `HANDOVER_SR66_EMPTY_STATE_ISSUE.md`, `GIT_COMMITS_REPORT.md`, `docs/ROLLOUT.md`, and add them to `.gitignore`. **Keep** `PRE_LAUNCH_AUDIT.md` and `plan.md` untracked-or-private per the human's choice (ask).
- [ ] Confirm T0.6 is done (realtime migration + `migrate` script removed).

### T4.6 🤖 SEC-022 + uncommitted changes
- [ ] Review the uncommitted working-tree changes listed in the audit addendum (`api/push-notify.js`, `crashReporter.js`, `slackNotificationService.js`, `.env.example`, ...).
- [ ] Move Slack posting server-side (`SLACK_*` env **without** `VITE_`); client calls a rate-limited `/api` handler (via the existing dynamic route per D2). Remove `VITE_SLACK_*` from `.env.example`.
- [ ] `googlePlacesNearbyService.js:10,62`: stop reading the API key from `localStorage`.

### T4.7 🤖 SEC-026: dependencies
- [ ] `npm audit fix` (no `--force`) in its own commit; confirm `npm audit --omit=dev` is clean and the build still passes.

### T4.8 🤖 SEC-027 / SEC-028 / SEC-029: remaining Low items
- [ ] SEC-027: remove company GSTIN, bank account, IFSC and address literals from `src/data/defaultPresets.js` (neutral placeholders; real values come from `system_settings`, see T3.5). Remove hardcoded `STF-*` ids (done in T3.3).
- [ ] SEC-028: remove stray `console.log` calls; in `ErrorBoundary.jsx:31` stop saving full stacks/customer text to `localStorage` (store error code + timestamp only).
- [ ] SEC-029: add a **magic-byte check** (PNG/JPEG/PDF/WebP) in `storage-presign.js` (or on upload completion) in addition to the MIME/extension allowlist; self-host the tesseract worker/wasm/lang files (no third-party CDN) or add SRI; move the WhatsApp number at `QuotationPreview.jsx:533` to `company_profile.whatsapp`.

### GATE G4
- [ ] 🧑 `curl -I` on the preview shows CSP, HSTS, nosniff, XFO on `/` and `no-store` on `/api/*`.
- [ ] `docker build` succeeds and the container runs non-root.
- [ ] Build and tests pass; no CSP violations in the browser console on the main flows.

---

## Phase 5: Auth hardening, correctness, scale

### T5.1 🤖 SEC-012: enforce suspension and fresh rates
- [ ] Extend `requireAuth.js` with `requireUser()`: after `verifyJwt`, re-read `status` from `dealer_accounts`/`staff_accounts` (cached 60 s in Redis); reject suspended/inactive.
- [ ] Use it in every handler. Cut `dealer:rates:<id>` TTL in `quotations.js:~148` to 60 s and delete it on admin save.

### T5.2 🤖 SEC-013: login hardening
File: `api/_lib/authLogin.js`, `api/_lib/rateLimiter.js`.
- [ ] Add a per-identifier counter (5 failures / 15 min). Use async `bcrypt.compare`, compare once on the exact password. One uniform "Invalid credentials" error.
- [ ] Production without `UPSTASH_REDIS_REST_*` → fail closed with a clear error at startup/first request.

### T5.3 🤖 SEC-015: JWT checks
- [ ] `jwt.js`: require `header.alg === 'HS256'` and verify `iss`. Bound cookie length. (Switch to `jose` + refresh tokens is post-launch.)

### T5.4 🤖 Idempotency (BUG-05)
- [ ] Migration `013_quotation_request_id.sql`: `ALTER TABLE quotations ADD COLUMN IF NOT EXISTS request_id uuid UNIQUE;`. Client sends `crypto.randomUUID()` per form session; server upserts on it.

### T5.5 🤖 SEC-018: share tokens
- [ ] Same migration: `share_expires_at timestamptz`; new tokens via `encode(gen_random_bytes(18),'hex')`; the public handler enforces expiry.

### T5.6 🤖 BUG-04: pagination and indexes
- [ ] limit/offset + explicit column lists for dealer, staff and customer-file lists. Indexes: `quotations(dealer_id, created_at DESC)`, `customer_files(dealer_id, status)`.

### T5.7 🤖 SEC-024: single source of truth
- [ ] Confirm no duplicate subsidy/tier-margin logic remains (re-run the grep from T3.3).

### T5.8 🤖 Load test script
- [ ] `scripts/loadtest/quotes.js` (k6): login + `/api/catalog` + `/api/quotations?action=list` at 200 VUs. **Do not run against production.**

### T5.9 🧑 Operations
- [ ] Run the k6 test against **staging**; fix timeouts (`places-nearby.js`, AI/OCR calls).
- [ ] Error monitoring (Sentry or Vercel log drain). Confirm backups/PITR and do one restore test. Write the rollback plan (Vercel Instant Rollback + the `pg_dump`).

### T5.10 🧑 Clean production data and accounts
- [ ] Review all dealer, staff and admin accounts in production (8 dealers, 5 staff seen by the probe): disable or delete test/seed/unknown accounts, confirm each real account's status, tier and margin cap.
- [ ] Review the 3 existing quotations and any customer files: delete test data. Confirm no account still uses a seeded default password (T2.5 reset covers passwords; this covers *existence* of accounts).

### T5.11 🧑 UI regression QA of the large `devlopment` rewrites
The audit could only run build + unit tests on these; nobody has UI-tested them.
- [ ] `CreateQuotation.jsx` (flexible structure types, freight presets, installation modes, locked BOM items): create quotes for kit and custom, each structure type, with and without freight; check totals against the engine.
- [ ] `HardwareMaster.jsx`, `PricingMaster.jsx`, `DealerManagement.jsx`, `AdminSettings.jsx`: create/edit/delete a module, inverter, BOM item, dealer, staff member, tier margin, terms text; hard refresh after each.
- [ ] Mobile responsiveness pass (last commit `1c1a35a`) on a real phone.

### T5.12 🤖 Deeper review of files the audit only pattern-scanned
The audit read ~49 files deeply and only pattern-scanned ~150 (see its coverage table). Run a focused read-only review and append findings to `PRE_LAUNCH_AUDIT_RECHECK.md` (do not fix silently; propose fixes):
- [ ] `src/components/AdminPortal/AdminSettings.jsx`, `CreateQuotation.jsx`, `HardwareMaster.jsx`, `AllQuotations.jsx`, `DealerManagement.jsx`, `PricingMaster.jsx`.
- [ ] All `scripts/**` (credentials, direct DB writes, `ssl.rejectUnauthorized:false`), `public/sw.js`, `public/sw-push.js`, `index.html` (external scripts/CDNs), `src/utils/*`, `src/services/*` not yet read.
- [ ] Check every item the audit marked UNVERIFIED: live body of `verify_user_credentials` (done in T0.4), SEC-011 branches, tesseract/html2pdf CDN URLs, `VITE_SLACK_CRASH_WEBHOOK_URL` in the built bundle, `next_quotation_seq` RPC existence.

### GATE G5
- [ ] A suspended dealer's next API call returns 403. Two rapid saves with the same `request_id` create one row. List endpoints return at most 100 rows.
- [ ] Load test: p95 acceptable, no connection exhaustion.
- [ ] Production data cleaned (T5.10), UI QA done (T5.11), review T5.12 produced no new Critical/High (or they are fixed).

---

## Phase 6: Re-verification and launch

### T6.1 🤖 Re-audit
- [ ] Re-run the checks from `PRE_LAUNCH_AUDIT.md` read-only: `npm audit`, `npm run build`, `npm test`, secret-regex grep on HEAD, dist secret-name grep, `git grep` for `admin123`, `p_password`, `USING (true)`.
- [ ] Write `PRE_LAUNCH_AUDIT_RECHECK.md`: a table of **every finding ID** with status `Fixed` / `Deferred (with reason)` / `Won't fix (with reason)`, plus evidence (file:line or command output, secrets masked).

### T6.2 🧑 Final checks
- [ ] Run `gitleaks detect --log-opts="--all"` yourself and confirm the old credentials are dead.
- [ ] Anon probe passes on production; the audit launch checklist has **no FAIL**.
- [ ] Domain, HTTPS, CORS origins and env vars verified in Vercel; `NODE_ENV=production`.

### T6.3 🧑 Soft launch
- [ ] Launch to 5-10 trusted dealers first. Watch logs and errors for 2-3 days, then open to all 200.

### GATE G6 = GO decision
GO only if: all Critical/High fixed, probe passes, launch checklist has no FAIL, rollback plan exists, production test data cleaned (T5.10) and UI QA passed (T5.11).

---

## Post-launch backlog

1. `jose` + refresh tokens, 8 h TTL (SEC-015).
2. Magic-byte file validation; self-host tesseract assets (SEC-029).
3. Remaining HC items (HC-01/02/06/07/10/11/14/15/17) if deferred in T3.5.
4. Offline save queue, further PWA/bundle trimming.
5. Consolidate root SQL files and `supabase/migrations` into one ordered set (`006`, `007` are missing).
6. Upgrade `tailwindcss` to clear the dev-chain highs (SEC-026).
7. Replace compatibility views and legacy tables with a clean schema.

---

## Appendix A: Finding → task map

| Finding | Task | Finding | Task |
|---|---|---|---|
| SEC-001 | T0.2 | SEC-016 | T4.1 |
| SEC-002 | T2.4, T2.6 | SEC-017 | T4.3 |
| SEC-003 | T0.3, T0.4 | SEC-018 | T5.5 |
| SEC-004 | T0.6 | SEC-019 | T1.6 |
| SEC-005 | T1.2 | SEC-020 | T4.4 |
| SEC-006 | T1.3 | SEC-021 | T4.5 |
| SEC-007 | T0.4, T2.5, T6.2 | SEC-022 | T0.4, T4.6 |
| SEC-008 | T2.1, T2.2 | SEC-023 | T2.3, T3.3 |
| SEC-009 | T1.5 | SEC-024 | T3.3, T5.7 |
| SEC-010 | T1.1 | SEC-025 | T4.2 |
| SEC-011 | T1.4 | SEC-026 | T4.7 |
| SEC-012 | T5.1 | SEC-027 | T3.3, T3.5, T4.8 |
| SEC-013 | T3.3, T5.2 | SEC-028 | T4.8 |
| SEC-014 | T2.3 | SEC-029 | T4.8 |
| SEC-015 | T5.3 | HC-01..18 | T3.1-T3.5 |
| BUG-01 | T1.6 | BUG-02 | T1.6 |
| BUG-03 | T2.2 | BUG-04 | T5.6 |
| BUG-05 | T5.4 | BUG-06 | T2.4 |
| BUG-07 (offline queue) | Post-launch backlog | Checklist: signups, buckets | T0.5 |
| Checklist: test data/accounts | T5.10 | Unreviewed UI / UNVERIFIED items | T5.11, T5.12 |
| Duplicate VARCHAR/numeric prices | T3.5 | | |
| SCALE-01/02 | T4.3, T5.8, T5.9 | TEST-01 | T1.7, T3.4 |

## Appendix B: Standard commands

```bash
npm run build
npm test
npm audit --omit=dev
git grep -nE "admin123|p_password\s*=" -- .
git grep -nE "\b(6000|78000|4500|6500|5500|1440)\b" -- src api ':!src/utils/__tests__' ':!src/data/gujaratDatabase.js'
git grep -nE "supabase\s*\.\s*(from|rpc)\([^)]*\)\s*\.(upsert|insert|update|delete)" -- src
node scripts/rollout/verify-anon-lockdown.mjs   # post-fix probe, counts only
```

## Appendix C: New environment variables (placeholders only in `.env.example`)

`ALLOWED_ORIGINS`, `PG_CA`, `SLACK_FILES_UPDATE` / `SLACK_CRASH_WEBHOOK_URL` (server-side, **no** `VITE_` prefix), `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (mandatory in production).

## Appendix D: Rollback per phase

| Phase | Rollback |
|---|---|
| 0, 1, 2 (code) | Vercel Instant Rollback to the previous deployment. |
| 2 (SQL) | Restore from the Phase 0 `pg_dump`, or re-grant specific privileges. Do not run the SQL without the dump. |
| 3 (seed migration) | Migration is additive/idempotent; revert code, leave settings in place. |
| 4 | Revert `vercel.json`/nginx headers; CSP can fall back to Report-Only instantly. |
| 5 | Additive columns/indexes only; revert code, leave schema. |

## Appendix E: Kickoff prompt to give Claude Code

```
Read plan.md and PRE_LAUNCH_AUDIT.md fully. Follow plan.md's rules strictly.
Start with Phase 0, task T0.2 (T0.1 is human-only: ask me for D0-D5 first).
Work one task at a time, commit per task, run build + tests after each, tick the checkbox in plan.md,
and STOP at every GATE and wait for me to say "continue". Never run SQL on production, never print secrets.
```
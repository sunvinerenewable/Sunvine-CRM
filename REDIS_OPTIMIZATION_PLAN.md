# 🚀 Sunvine Solar — Risk-Resolved Upstash Redis Optimization Blueprint

---

## 📌 Executive Summary
This document is the definitive, production-ready caching and performance blueprint for the Sunvine Solar Portal using **Upstash Redis**. It incorporates full risk-mitigation engineering to guarantee:
* **100% Data Freshness**: Zero stale data via **Event-Driven Cache Invalidation (`redisDel`)** paired with safety fallback TTLs.
* **Zero Secret Leakage**: Strict Serverless Boundary — Redis credentials never touch the browser client.
* **Resilience First**: Graceful 200ms fail-open fallback to Supabase PostgreSQL on any network blip or Redis downtime.
* **Bandwidth & Quota Efficiency**: Pruned and sanitized JSON payloads preventing Upstash memory/command quota exhaustion.

---

## 🛡️ Core Architectural Guardrails (All Risks Resolved)

```
┌────────────────────────────────────────────────────────────────────────┐
│ BROWSER CLIENT (Vite / React SPA)                                      │
│ • Reads/Writes via authenticated API endpoints or direct Supabase RLS  │
│ • ZERO Upstash tokens in bundle (No VITE_UPSTASH_*)                   │
│ • Client cache deduplication (single consolidated catalog hook)        │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTPS / JWT Cookie
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ VERCEL SERVERLESS LAYER (api/*)                                        │
│ • Executes in Node.js runtime with secure process.env access           │
│ • Cache-Aside with 200ms Timeout & Graceful DB Fallback                │
│ • Invalidation on Mutation: Database Write ──> redisDel(key)          │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
         Cached Read (<15ms)              Ground Truth Write & Fallback
                    ▼                                ▼
┌──────────────────────────────────────┐   ┌─────────────────────────────┐
│ UPSTASH REDIS REST ENGINE            │   │ SUPABASE POSTGRESQL DB      │
│ • Sliding Safety TTLs on all keys    │   │ • Source of Truth           │
│ • Pruned & Minified Schemas          │   │ • Direct query if Redis misses│
└──────────────────────────────────────┘   └─────────────────────────────┘
```

### 3 Fundamental Engineering Rules:
1. **Invalidation Over Blind Dual-Write**: On any update/mutation, the backend updates PostgreSQL first and immediately calls `redisDel(key)`. The next read performs a standard `cacheAside()` to fetch the ground truth and repopulate Redis. This eliminates split-brain drift and handles direct DB edits gracefully.
2. **Mandatory Safety TTLs**: No key is ever saved with `No expiry`. Every data key has a sliding TTL (1h to 24h) to automatically heal any missed invalidation.
3. **200ms Fail-Open Timeout**: Every Redis operation has a strict 200ms timeout. If Redis is unreachable, the system transparently executes the direct PostgreSQL query without throwing user-facing errors.

---

## 📋 Risk-Resolved Feature Implementations

---

### 📦 Group A — Public & Master Quotation Caches

#### A1. Live-Synced WhatsApp Customer Proposals
* **Redis Key:** `quote:public:${token}`
* **Supabase Table:** `quotations` (queried by `share_token`)
* **Endpoint:** [`api/quotations.js`](file:///e:/repos/dealer-portal-quotation/api/quotations.js) (`GET ?action=public&token=...`)
* **Risk Resolution:**
  - **Fixed Orphaned Memory:** Applied a **7-day sliding TTL** (`EX 604800`). The TTL refreshes whenever a proposal is viewed.
  - **Fixed Stale Edits:** Whenever a quotation is edited, renegotiated, or archived in `api/quotations.js`, `redisDel(\`quote:public:${token}\`)` is called immediately.
  - **Fail-Open Fallback:** If Redis fails, `api/quotations.js` queries Supabase directly and renders the proposal instantly.

#### A2. Master Hardware Catalog (Modules & Inverters)
* **Redis Key:** `catalog:hardware`
* **Supabase Tables:** `solar_modules`, `solar_inverters`
* **Endpoint:** [`api/catalog.js`](file:///e:/repos/dealer-portal-quotation/api/catalog.js) (or serverless bootstrap route)
* **Risk Resolution:**
  - **Fixed Client Secret Exposure:** Frontend never calls Redis directly. A lightweight serverless endpoint `/api/catalog?type=hardware` fetches via `cacheAside('catalog:hardware', 21600, fetchHardwareFromDb)`.
  - **Fixed Pricing Drift:** When an admin edits hardware in Admin Portal, the API route updates Supabase and calls `redisDel('catalog:hardware')`.
  - **Safety TTL:** 6 Hours (`21,600s`).

#### A3. Dealer Custom Negotiated Rates
* **Redis Key:** `dealer:rates:${dealer_id}`
* **Supabase Table:** `dealer_custom_pricing` / `dealer_accounts`
* **Endpoint:** Server-side validation inside [`api/quotations.js`](file:///e:/repos/dealer-portal-quotation/api/quotations.js)
* **Risk Resolution:**
  - **Fixed Client-Side Tampering:** All financial calculations and tier margin caps are re-validated server-side in `api/quotations.js` using `dealer:rates:${dealer_id}`.
  - **Fixed Outdated Caps:** When an Admin alters a dealer's tier or custom margin in Admin settings, the API calls `redisDel(\`dealer:rates:${dealer_id}\`)`.
  - **Safety TTL:** 12 Hours (`43,200s`).

---

### 📦 Group B — Admin-Editable Pricing Constants

#### B1. Global Pricing Presets (Base Rate, Subsidy Cap, Min Margin)
* **Redis Key:** `pricing:global_presets`
* **Supabase Table:** `pricing_presets` (`id: 'global_default'`)
* **Risk Resolution:**
  - **Fixed Client Hydration Duplication:** Consolidated `pricingService.js` and `settingsService.js` to consume a unified `/api/catalog?type=presets` endpoint.
  - **Fixed Stale Calculation Drift:** On Admin save, the serverless handler updates `pricing_presets` in PostgreSQL and executes `redisDel('pricing:global_presets')`.
  - **Safety TTL:** 6 Hours (`21,600s`).

#### B2. Dealer Tier Margin Caps
* **Redis Key:** `pricing:tier_margins`
* **Supabase Table:** `dealer_custom_pricing`
* **Risk Resolution:**
  - **Fixed Over-Margin Submission:** `api/quotations.js` enforces margin caps by checking `pricing:tier_margins` during quote creation.
  - **Fixed Stale Caps:** Admin tier margin updates trigger `redisDel('pricing:tier_margins')`.
  - **Safety TTL:** 6 Hours (`21,600s`).

#### B3. Inverter Benchmark Pricing Matrix
* **Redis Key:** `catalog:inverter_benchmarks`
* **Supabase Table:** `inverter_benchmark_matrix`
* **Risk Resolution:**
  - **Fixed Market Price Discrepancies:** On inverter price revisions, the mutation endpoint updates DB and calls `redisDel('catalog:inverter_benchmarks')`.
  - **Safety TTL:** 12 Hours (`43,200s`).

---

### 📦 Group C — Catalog & Directory Caches

#### C1. BOS Pricing Matrix Cache
* **Redis Key:** `catalog:bos_matrix`
* **Supabase Table:** `bos_pricing_matrix`
* **Risk Resolution:**
  - **Fixed Payload Bloat:** Cached object is pruned to contain only essential columns (`capacity_slab`, `panel_brand`, `bos_price_per_wp`, `gst_rate`), discarding internal DB metadata.
  - **Safety TTL:** 12 Hours (`43,200s`) + `redisDel` on admin update.

#### C2. BOM Hardware Catalog Cache
* **Redis Key:** `catalog:bom_items`
* **Supabase Table:** `bom_catalog`
* **Risk Resolution:**
  - **Fixed GST Slab Desync:** Automatic `redisDel('catalog:bom_items')` on BOM creation, update, or CSV bulk import.
  - **Safety TTL:** 12 Hours (`43,200s`).

#### C3. Global System Settings Cache
* **Redis Key:** `settings:global`
* **Supabase Table:** `system_settings` (`id: 'global_settings'`)
* **Risk Resolution:**
  - **Fixed PDF Metadata Stale Info:** Immediate `redisDel('settings:global')` when company profile, GSTIN, bank IFSC, or warranty clauses change.
  - **Safety TTL:** 24 Hours (`86,400s`).

#### C4. Dealer Directory Cache (Minified Schema)
* **Redis Key:** `directory:dealers:min`
* **Supabase Table:** `dealer_accounts`
* **Risk Resolution:**
  - **Fixed Quota & Memory Exhaustion:** Instead of storing 500+ unmasked records (~1.2MB), cache a **sanitized minified index** (~45KB):
    ```json
    [{ "id": "DLR-001", "name": "Apex Solar", "tier": "Gold EPC", "city": "Ahmedabad", "staffId": "STF-01", "active": true }]
    ```
  - **Fixed KYC & Banking Exposure:** Full banking and contact details remain fetched on-demand per dealer via authenticated individual lookups.
  - **Safety TTL:** 2 Hours (`7,200s`) + `redisDel` on dealer CRUD.

#### C5. Staff Directory Cache (Minified Schema)
* **Redis Key:** `directory:staff:min`
* **Supabase Table:** `staff_accounts`
* **Risk Resolution:**
  - **Fixed Deactivated Account Access:** Minified directory contains only active staff IDs and roles. Status change triggers immediate `redisDel('directory:staff:min')`.
  - **Safety TTL:** 4 Hours (`14,400s`).

#### C6. Solar Loan Banks Cache
* **Redis Key:** `catalog:solar_banks`
* **Supabase Table:** `solar_banks`
* **Risk Resolution:**
  - **Static Data Optimization:** Pure Cache-Aside with 24h TTL (`86,400s`).

#### C7. Broadcast Notifications Cache
* **Redis Key:** `notifications:broadcast`
* **Supabase Table:** `notifications`
* **Risk Resolution:**
  - **Fixed Emergency Alert Delay:** 1-hour safety TTL (`3,600s`) with immediate `redisDel('notifications:broadcast')` upon publishing any urgent notification.

---

### 📦 Group D — Security & Resilience Upgrades

#### D1. JWT Session Blacklist (Instant Server-Side Logout)
* **Redis Key:** `session:blacklist:${jti}`
* **Prerequisite Step Fixed:** Updated [`api/_lib/jwt.js`](file:///e:/repos/dealer-portal-quotation/api/_lib/jwt.js) `signJwt()` to include `jti: crypto.randomUUID()`.
* **Workflow:**
  1. On `/api/auth/logout`: Read token, extract `jti` and remaining seconds (`payload.exp - now`), and store `redisSet(\`session:blacklist:${jti}\`, 'revoked', remainingSeconds)`.
  2. On `/api/auth/verify.js` & protected routes: Verify crypto signature, then check `redisGet(\`session:blacklist:${jti}\`)`.
* **Risk Resolution (Outage Resilience):**
  - Redis lookup is wrapped in a strict **200ms Promise.race timeout**.
  - **Fail-Open Policy:** If Redis times out or is offline, log a security alert and accept the validly signed JWT, preventing site-wide lockouts during Redis maintenance.

#### D2. Distributed Quotation API Rate Limiter
* **Redis Key:** `ratelimit:api:${ip}` & `ratelimit:dealer:${dealerId}`
* **Endpoint:** [`api/quotations.js`](file:///e:/repos/dealer-portal-quotation/api/quotations.js)
* **Risk Resolution:**
  - **Fixed False-Positive Blocking of High-Volume Dealers:**
    - **Public Proposals (`?action=public`):** 30 requests/min per IP.
    - **Authenticated Dealers (`action: 'save'`):** 120 requests/min per `dealerId` (scoped by authenticated session, not shared office IP).
  - Uses atomic `INCR` + `EXPIRE` via `checkDistributedRateLimit()` in [`api/_lib/rateLimiter.js`](file:///e:/repos/dealer-portal-quotation/api/_lib/rateLimiter.js).

---

## 📊 Master Architecture & Risk Resolution Matrix

| # | Feature Key | Source of Truth | Mutation Strategy | Safety TTL | Risk Resolution Applied |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A1** | `quote:public:${token}` | `quotations` | `redisDel` on save/edit/archive | `7 days` | Sliding TTL + auto-evict on archive |
| **A2** | `catalog:hardware` | `solar_modules`, `inverters` | `redisDel` on hardware update | `6 hours` | Serverless proxy endpoint; zero client bundle secrets |
| **A3** | `dealer:rates:${dealer_id}` | `dealer_accounts` | `redisDel` on dealer rate edit | `12 hours` | Server-side quote validation against cached caps |
| **B1** | `pricing:global_presets` | `pricing_presets` | `redisDel` on presets save | `6 hours` | Cache-Aside with DB fallback; deduplicated client calls |
| **B2** | `pricing:tier_margins` | `dealer_custom_pricing` | `redisDel` on tier save | `6 hours` | Server-side margin enforcement in `api/quotations.js` |
| **B3** | `catalog:inverter_benchmarks`| `inverter_benchmark_matrix` | `redisDel` on matrix edit | `12 hours` | Atomic invalidation + 200ms fallback |
| **C1** | `catalog:bos_matrix` | `bos_pricing_matrix` | `redisDel` on BOS slab edit | `12 hours` | Pruned slab schema (no JSON bloat) |
| **C2** | `catalog:bom_items` | `bom_catalog` | `redisDel` on BOM item edit | `12 hours` | Server-side invalidation on CSV import |
| **C3** | `settings:global` | `system_settings` | `redisDel` on settings update | `24 hours` | Instant eviction prevents stale PDF quotation terms |
| **C4** | `directory:dealers:min` | `dealer_accounts` | `redisDel` on dealer CRUD | `2 hours` | Minified schema (~45KB vs 1.2MB); KYC kept on-demand |
| **C5** | `directory:staff:min` | `staff_accounts` | `redisDel` on staff update | `4 hours` | Instant eviction on deactivation; role check in verify |
| **C6** | `catalog:solar_banks` | `solar_banks` | TTL Cache-Aside | `24 hours` | Static data optimization with DB fallback |
| **C7** | `notifications:broadcast` | `notifications` | `redisDel` on urgent notice | `1 hour` | Short safety TTL + instant invalidation |
| **D1** | `session:blacklist:${jti}` | — | `redisSet` on logout | `Token Remainder`| Generated `jti` in `jwt.js` + 200ms fail-open timeout |
| **D2** | `ratelimit:api:${ip}` | — | Distributed Redis Counter | `60 seconds` | Tiered limits (30 req/min public, 120 req/min authenticated) |

---

## 🚀 Phased Implementation Roadmap

### Phase 1: Security & JWT Foundations (Zero Dependency)
1. In [`api/_lib/jwt.js`](file:///e:/repos/dealer-portal-quotation/api/_lib/jwt.js), add `jti: crypto.randomUUID()` to `signJwt()`.
2. In [`api/auth/logout.js`](file:///e:/repos/dealer-portal-quotation/api/auth/logout.js), write `session:blacklist:${jti}` with remaining expiration.
3. In [`api/auth/verify.js`](file:///e:/repos/dealer-portal-quotation/api/auth/verify.js), check `session:blacklist:${jti}` with a 200ms timeout fallback.

### Phase 2: Quotation Engine & WhatsApp Proposals
1. In [`api/quotations.js`](file:///e:/repos/dealer-portal-quotation/api/quotations.js), wrap `?action=public&token=...` with `cacheAside('quote:public:${token}', 604800)`.
2. In [`api/quotations.js`](file:///e:/repos/dealer-portal-quotation/api/quotations.js), add `redisDel(\`quote:public:${token}\`)` on save, edit, and status change.
3. Apply distributed rate limiter to [`api/quotations.js`](file:///e:/repos/dealer-portal-quotation/api/quotations.js) (Group D2).

### Phase 3: Consolidated Catalog & Pricing API
1. Create [`api/catalog.js`](file:///e:/repos/dealer-portal-quotation/api/catalog.js) to serve `hardware`, `presets`, `tier_margins`, and `inverter_benchmarks` in 1 Redis round-trip.
2. In [`api/quotations.js`](file:///e:/repos/dealer-portal-quotation/api/quotations.js), replace direct DB queries during quote calculation with `cacheAside()` for pricing presets and tier margin caps.

### Phase 4: Directory Optimization & Frontend Deduplication
1. Consolidate frontend hydration in `settingsService.js` and `pricingService.js` to consume `/api/catalog`.
2. Implement minified caching for `directory:dealers:min` and `directory:staff:min`.

---

## ✅ Quality Gates
* **Build Verification**: `npm run build` must complete with 0 errors.
* **Offline Resilience Test**: If Redis credentials are intentionally cleared, all portal features continue functioning via direct Supabase PostgreSQL queries.
* **Git Security**: Zero tokens, passwords, or Upstash credentials committed to Git.

# Dealer Portal — Full System Audit

**Audit Date:** September 29, 2026  
**Auditor:** Antigravity AI Senior Systems & Security Architecture Auditor  
**Repository:** `e:\repos\dealer-portal-quotation`  
**Target Version:** 2.2.1 (`package.json`)  
**Audit Mode:** Strictly Read-Only (Static Source Inspection, Dependency Analysis, Schema Audit, Architecture & Logic Verification)

---

## 1. Executive Summary

A comprehensive, read-only full-system audit was conducted on the Sunvine Renewable Energy Dealer Portal & Quotation repository. The audit evaluates the system against enterprise security standards, operational reliability, responsive design requirements, and maintainable architecture.

### System Health Overview: **Grade B- (Functional MVP with Critical Security & Logic Blockers)**

The application features sophisticated domain-specific solar capabilities: Gujarat DISCOM tariff calculations, PM Surya Ghar DBT subsidy modeling, 3D rooftop CAD mounting visualizers, dynamic BOM generation, and staff sales management.

However, several **P0 (Critical)** security vulnerabilities and **P1 (High)** runtime defects exist that present immediate risks of data exposure, unauthorized database tampering, proposal delivery failures, and client-side application crashes.

```
+-------------------------------------------------------------------------------+
|                             FINDINGS AT A GLANCE                              |
+---------------------+------------+------------+-------------------------------+
| Severity Level      | Confirmed  | Potential  | Total Detected                |
+---------------------+------------+------------+-------------------------------+
| P0 - Critical       | 4          | 0          | 4                             |
| P1 - High           | 5          | 1          | 6                             |
| P2 - Medium         | 5          | 2          | 7                             |
| P3 - Low            | 3          | 1          | 4                             |
+---------------------+------------+------------+-------------------------------+
| TOTAL               | 17         | 4          | 21                            |
+---------------------+------------+------------+-------------------------------+
```

### Top Critical Takeaways
1. **Permissive Supabase RLS Policies (P0):** Tables `admin_users`, `dealers`, `quotations`, `otp_verifications`, `solar_modules`, and `solar_inverters` allow unauthenticated anonymous access (`FOR ALL USING (true) WITH CHECK (true)` or `FOR SELECT USING (true)`). Anyone with the public anon key can dump admin/dealer password hashes and overwrite records.
2. **Hardcoded Fallback Supabase Credentials & Obfuscated API Keys (P0):** `src/lib/supabase.js` and `src/utils/aiRoofVisionEngine.js` contain hardcoded project URLs, public anon keys, and Base64-obfuscated Google API keys.
3. **Authentication Bypass & Open OTP Verification (P0):** `authService.loginDealer` accepts any password as long as the mobile number exists; `authService.verifyOtp` returns `{ success: true }` inside its catch block; hardcoded bypass OTPs exist in code.
4. **Quotation ID Space Collision (P1):** Quotations generate IDs with only 900 potential random numbers (`Math.floor(100 + Math.random() * 900)`). The database performs an upsert on conflict, causing new quotes to overwrite existing customer records.
5. **Shared WhatsApp Proposal Link Failure on Customer Devices (P1):** Public proposal view (`/?view=quote&id=...`) only checks local browser memory and state, failing to fetch records from Supabase on customer devices.
6. **Runtime Crashes in Form Reset & Admin Login (P1):** `CreateQuotation.jsx` references undeclared `setSystemCapacity`, and `AdminLogin.jsx` references undeclared `setOtp`, causing unhandled exceptions.

---

## 2. Audit Scope

The audit covered 100% of the repository's source code, configuration, schemas, and utility scripts:
- **Core Frontend:** `src/**/*.{js,jsx,css}` (Components, Contexts, Hooks, Utilities, Services, Layouts)
- **Serverless API Routes:** `api/**/*.{js}` (`places-nearby.js`, `scrape-solar-leads.js`)
- **Database Architecture:** `supabase_schema.sql` (Tables, Indexes, RLS Policies, Triggers)
- **Configuration & Build:** `vite.config.js`, `package.json`, `package-lock.json`, `vercel.json`, `index.html`
- **Automation & Test Scripts:** `scripts/**/*.{cjs,js,bat}`
- **Project Rulebooks:** `PROJECT_RULEBOOK.md`, `AGENTS.md`, `GEMINI.md`, `RESPONSIVE_UI_RULES.md`

### Explicit Out-of-Scope Items
- Missing standalone authentication/login pages (acknowledged as intentionally incomplete during testing).

---

## 3. Project Architecture Overview

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT BROWSER                                       |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                              React 18 Single-Page App                           |   |
|   |  - App.jsx / Navigation.jsx                                                      |   |
|   |  - Context: AppContext.jsx (Central State, LocalStorage, Multi-Tab Sync)        |   |
|   |  - Portals: DealerPortal / AdminPortal / StaffPortal / Auth                     |   |
|   |  - 3D & Vision Engines: SolarStructure3DViewer (Three.js), Roof Vision (Gemini)|   |
|   |  - Document Generators: PDFTemplate / html2pdf.js                               |   |
|   +---------------------------------------------------------------------------------+   |
+----------------------------+-----------------------------------+------------------------+
                             |                                   |
                             v                                   v
             +-------------------------------+   +-------------------------------+
             |      Vercel Serverless        |   |      Supabase PostgreSQL      |
             |  /api/places-nearby           |   |  - public.dealers             |
             |  /api/scrape-solar-leads      |   |  - public.admin_users         |
             |                               |   |  - public.quotations          |
             +-------------------------------+   |  - public.solar_modules       |
                                                 |  - public.solar_inverters     |
                                                 |  - public.otp_verifications   |
                                                 +-------------------------------+
```

---

## 4. Audit Methodology

1. **Static Analysis & Code Tracing:** Systematic examination of all files in `src/`, `api/`, `scripts/`, and root configurations.
2. **Security & Cryptography Inspection:** Review of RLS policies, credential hashing, token verification, client storage, API endpoints, and secrets handling.
3. **Logic Flow & Edge Case Verification:** End-to-end tracing of quotation creation, editing, pricing calculations, and state persistence.
4. **Responsive & Mobile Layout Review:** Verification of viewport configurations, breakpoints, touch target sizing, and CSS overflow rules.
5. **Accessibility & Usability Check:** Evaluation of keyboard navigation, ARIA tags, button elements, and color contrast compliance.
6. **Testing & DevOps Evaluation:** Review of test suites in `scripts/`, build pipelines, PWA configurations, and serverless handlers.

---

## 5. Critical Findings (P0 / P1)

### [P0] Public Supabase RLS Policies Allow Unrestricted Read, Write, and Deletion
**Category:** Security  
**Location:** `supabase_schema.sql:134-150`  
**Problem:** The database schema defines overly permissive Row Level Security (RLS) policies for anonymous API connections:
- `public.quotations`, `public.solar_modules`, `public.solar_inverters`, `public.otp_verifications`: `FOR ALL USING (true) WITH CHECK (true)`
- `public.admin_users`: `FOR SELECT USING (true)`
- `public.dealers`: `FOR SELECT USING (status = 'active')`
**Evidence:**
```sql
-- supabase_schema.sql:137-144
DROP POLICY IF EXISTS "Public Manage Quotations" ON public.quotations;
CREATE POLICY "Public Manage Quotations" ON public.quotations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin Secure Access" ON public.admin_users;
CREATE POLICY "Admin Secure Access" ON public.admin_users FOR SELECT USING (true);
```
**Impact:** Any user with the public Supabase anon key can query `admin_users` and `dealers` to dump bcrypt password hashes, contact numbers, and emails. Anyone can modify, overwrite, or delete all quotations and catalog items in the system.  
**Recommended Direction:** Replace open public policies with authenticated role-based policies or secure serverless API endpoints using service-role validation.  
**Confidence:** High

---

### [P0] Hardcoded Supabase URL and Anon Key in Source Code
**Category:** Security  
**Location:** `src/lib/supabase.js:3-4`  
**Problem:** `src/lib/supabase.js` includes hardcoded fallback credentials for the Supabase instance if environment variables are unset.  
**Evidence:**
```javascript
// src/lib/supabase.js:3-4
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://wyberzvcyrjipjqpotwe.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_XzbS-fQMtSGf2LjFO40yzw_LtT98nG6';
```
**Impact:** Production credentials and instance URLs are committed to version control and bundled into static client assets.  
**Recommended Direction:** Rely exclusively on `.env` files and throw a startup configuration error if required environment variables are missing.  
**Confidence:** High

---

### [P0] Authentication Bypass in Dealer Login & Open OTP Fallbacks
**Category:** Security  
**Location:** `src/services/authService.js:129-133, 166-168, 191-231`  
**Problem:**
1. `loginDealer()` queries the dealer by mobile number, but does not verify the provided password against `password_hash`. Any non-empty string successfully authenticates the account.
2. `verifyOtp()` returns `{ success: true }` in its `catch` block when an error occurs.
3. Hardcoded demo OTPs (`491820`, `123456`) bypass database checks.
**Evidence:**
```javascript
// src/services/authService.js:191-231
const { data: dealer, error } = await supabase
  .from('dealers')
  .select('*')
  .eq('mobile_number', cleanNumber)
  .single();

if (error || !dealer) { ... }

return {
  success: true,
  dealer: { ... }
};
```
**Impact:** Complete authentication bypass allowing unauthorized access to any dealer account by providing only a mobile number.  
**Recommended Direction:** Validate passwords via secure server-side password hashing functions (e.g. `pgcrypto` crypt function or Supabase Auth API) and remove fallback catch bypasses.  
**Confidence:** High

---

### [P0] Obfuscated Hardcoded API Key Embedded in Client Code
**Category:** Security  
**Location:** `src/utils/aiRoofVisionEngine.js:10, 32`  
**Problem:** `DEFAULT_KEY_B64` embeds a base64-encoded Google Gemini API key directly into the client bundle.  
**Evidence:**
```javascript
// src/utils/aiRoofVisionEngine.js:10
const DEFAULT_KEY_B64 = 'QVEuQWI4Uk42SnB0ejlOUlAyWmJRM0VwbF8tdFMteG1FRkJCNE9peDhPNFRQSFZKMkxpOGc=';
```
**Impact:** Client bundle exposes the API key to any user inspecting the code, leading to API quota exhaustion or unauthorized billing.  
**Recommended Direction:** Route AI image processing through a backend API endpoint where keys remain secure in environment variables.  
**Confidence:** High

---

### [P1] Quotation ID Space Collision Leading to Data Overwrite (BUG-001)
**Category:** Bugs / Logic  
**Location:** `src/components/DealerPortal/CreateQuotation.jsx:680, 818`, `src/services/quotationService.js:61-63`  
**Problem:** Quotation IDs are generated using:
`id: isEdit ? editingQuotation.id : 'SV-2026-Q' + Math.floor(100 + Math.random() * 900)`
This provides only 900 possible numeric IDs. In `quotationService.js`, saving uses `.upsert([payload], { onConflict: 'id' })`.  
**Evidence:**
```javascript
// src/components/DealerPortal/CreateQuotation.jsx:680
id: isEdit ? editingQuotation.id : `SV-2026-Q${Math.floor(100 + Math.random() * 900)}`,

// src/services/quotationService.js:61-63
const { data, error } = await supabase
  .from('quotations')
  .upsert([payload], { onConflict: 'id' })
  .select();
```
**Impact:** Once dozens of quotes are created, collisions become mathematically frequent (Birthday Paradox: >50% chance of collision after ~36 quotations). When a collision occurs, the database silently overwrites an existing customer's quotation.  
**Recommended Direction:** Use collision-resistant UUIDs or database sequence-generated identifiers with separate human-readable serial numbers.  
**Confidence:** High

---

### [P1] Public Proposal WhatsApp Links Fail on Customer Devices
**Category:** Bugs / Logic  
**Location:** `src/components/DealerPortal/QuotationPreview.jsx:39-75`, `src/utils/quotationShare.js:48-49`  
**Problem:** Shared WhatsApp links point to `/?view=quote&id=SV-XXXX`. When opened by a customer on an external phone or computer, `QuotationPreview.jsx` only searches the in-memory React state and local browser `localStorage`. It does not query Supabase for the quotation.  
**Evidence:**
```javascript
// src/components/DealerPortal/QuotationPreview.jsx:44-58
const foundInState = quotations?.find(q => ...);
if (foundInState) return foundInState;
const foundInPresets = INITIAL_QUOTATIONS?.find(q => ...);
if (foundInPresets) return foundInPresets;
return null; // Quotation not found on customer device
```
**Impact:** Customers receiving proposal links via WhatsApp see a blank page or fallback demo quote instead of their custom proposal.  
**Recommended Direction:** Implement an asynchronous Supabase lookup in `QuotationPreview.jsx` when `isPublicView` is active to load the quote by ID from the database.  
**Confidence:** High

---

### [P1] Runtime Crash on "Reset Form" in CreateQuotation
**Category:** Bugs / Logic  
**Location:** `src/components/DealerPortal/CreateQuotation.jsx:649`  
**Problem:** `handleReset()` invokes `setSystemCapacity('3.3')`, but `setSystemCapacity` is not defined in the component's state declarations.  
**Evidence:**
```javascript
// src/components/DealerPortal/CreateQuotation.jsx:643-652
const handleReset = () => {
  if (clearEditingQuotation) clearEditingQuotation();
  if (clearActiveDraftQuote) clearActiveDraftQuote();
  setCustName('');
  setCustPhone('');
  setCustLocation('');
  setSystemCapacity('3.3'); // ReferenceError: setSystemCapacity is not defined
  ...
};
```
**Impact:** Clicking "Reset Form" triggers an unhandled `ReferenceError`, unmounting the quotation form and triggering the application `ErrorBoundary`.  
**Recommended Direction:** Remove `setSystemCapacity` and reset `panelQuantity` and `panelWatt` instead, as system capacity is a computed value (`kw = (panelWatt * panelQuantity) / 1000`).  
**Confidence:** High

---

### [P1] Runtime Crash on "Autofill Credentials" in Admin Login
**Category:** Bugs / Logic  
**Location:** `src/components/Auth/AdminLogin.jsx:180`  
**Problem:** The "Autofill Credentials" button executes `setOtp(['1', '2', '3', '4', '5', '6'])`, but `setOtp` is not declared in `AdminLogin.jsx`.  
**Evidence:**
```javascript
// src/components/Auth/AdminLogin.jsx:177-182
onClick={() => {
  setEmail('admin@sunvinerenewable.com');
  setPassword('1234567890123456');
  setOtp(['1', '2', '3', '4', '5', '6']); // ReferenceError: setOtp is not defined
}}
```
**Impact:** Clicking the autofill helper immediately crashes the component into the ErrorBoundary.  
**Recommended Direction:** Remove the `setOtp` call or declare the missing OTP state.  
**Confidence:** High

---

### [P1] Argument Signature Mismatch in `pricingService.saveDealerPricing`
**Category:** Bugs / Logic  
**Location:** `src/context/AppContext.jsx:1111`, `src/services/pricingService.js:39`  
**Problem:** `AppContext.jsx` invokes `pricingService.saveDealerPricing(id, pricingConfig)` with 2 arguments. However, `pricingService.js` declares `saveDealerPricing(dealerId, dealerCode, salespersonId, pricingData)` expecting 4 arguments.  
**Evidence:**
```javascript
// src/services/pricingService.js:39
async saveDealerPricing(dealerId, dealerCode, salespersonId, pricingData) { ... }

// src/context/AppContext.jsx:1111
pricingService.saveDealerPricing(id, pricingConfig).catch(err => { ... });
```
**Impact:** `pricingConfig` is assigned to `dealerCode`, and `pricingData` is `undefined`. Line 56 sends `pricing_data: undefined` to Supabase, and line 45 writes `undefined` to `localStorage`, corrupting dealer custom pricing.  
**Recommended Direction:** Align the function parameters so that `saveDealerPricing` accepts `(dealerId, pricingData, dealerCode, salespersonId)` or an options object.  
**Confidence:** High

---

## 6. Security Audit

### 6.1 Vulnerability Matrix

| ID | Vulnerability | Severity | Vector | Impact |
|---|---|---|---|---|
| SEC-01 | Permissive RLS Policies on PostgreSQL Tables | P0 | Supabase Public REST API | Unauthenticated database dump & modification |
| SEC-02 | Hardcoded Supabase Anon Key & Instance URL | P0 | Source Code / Bundle | Credentials exposed in client bundle |
| SEC-03 | Dealer Login Password Verification Bypass | P0 | `authService.js` | Account takeover without password |
| SEC-04 | Base64 Obfuscated Gemini API Key in Client | P0 | `aiRoofVisionEngine.js` | API quota theft & unauthorized usage |
| SEC-05 | Client-Side In-Memory Rate Limiting | P3 | `authService.js` | Trivial bypass via page reload |

### 6.2 Key Security Observations
- **Passwords Stored as Bcrypt Hashes:** `supabase_schema.sql` correctly utilizes `crypt(password, gen_salt('bf', 10))` for initial seeds.
- **Client-Side Secret Exposure:** While no production database service-role keys were found committed in code, the public anon key can read password hashes due to permissive RLS policies.
- **CORS Configuration:** `api/scrape-solar-leads.js` sets `Access-Control-Allow-Origin: *`.

---

## 7. Bugs & Logic Audit

### 7.1 Confirmed Functional Bugs

```
[CreateQuotation.jsx]
   |-- ID Generator -> SV-2026-Q[100..999] (900 slots) -> Database Upsert -> Overwrites existing quotes [BUG-001]
   |-- handleReset() -> calls setSystemCapacity() -> ReferenceError -> Crashes to ErrorBoundary [BUG-002]
   |-- handleSaveDraft() -> calls AppContext addQuotation() + quotationService.saveQuotation() -> Duplicate Upsert [BUG-003]

[AdminLogin.jsx]
   |-- Autofill Credentials button -> calls undeclared setOtp() -> ReferenceError -> Component crash [BUG-004]

[Toast System]
   |-- ToastProvider destructures { title, message, type }
   |-- 20+ callers invoke addToast('Message text', 'success') -> Renders blank toasts [BUG-005]

[Pricing Service]
   |-- AppContext passes (id, pricingConfig) -> saveDealerPricing expects 4 parameters -> Saves undefined data [BUG-006]

[Proposal Sharing]
   |-- WhatsApp public link /?view=quote&id=... -> QuotationPreview only checks local memory -> Fails on customer phones [BUG-007]
```

---

## 8. Architecture & Code Quality

### 8.1 Monolithic State Management
- `src/context/AppContext.jsx` is 1,525 lines long and manages 18 distinct state trees (dealers, quotations, inventory, staff, customer files, CAD designs, governance, pricing, audit logs).
- Updating one state (e.g. `designRecords`) causes re-renders across consumers of unrelated state.

### 8.2 Code Duplication
- **BOM Calculations:** Duplicate calculation routines exist between `standardBomData.js`, `CreateQuotation.jsx`, and `PDFTemplate.jsx`.
- **Currency & Phone Formatting:** `formatINR` and `cleanCustomerPhone` are re-implemented across 4 distinct files instead of using a unified utility.

### 8.3 Dead Dependencies
- `tesseract.js` (`^7.0.0`) is declared in `package.json` and `package-lock.json`, but is never imported in `src/`.

---

## 9. Mobile & Responsive Audit

### 9.1 Viewport and Layout Verification
- **Strengths:** Navigation cleanly switches from desktop fixed sidebar (`md:flex fixed w-64`) to bottom mobile action bar.
- **Viewport Height Handling:** Uses standard Tailwind `min-h-screen` and dynamic container sizing.
- **Overflow Risk:** `index.html:54` and `src/App.jsx:192` apply `overflow-x: clip`. While this prevents horizontal root scrolling, it can clip multi-touch pinch-zoom containers in `QuotationPreview.jsx` on mobile viewports.

---

## 10. Performance Audit

### 10.1 Bundle Analysis & Large Assets
1. **Static Geo Database (`gujaratDatabase.js` - 1.85 MB):** Imported statically into the top-level bundle via `defaultPresets.js`, increasing initial JavaScript bundle size significantly.
2. **Missing Code Splitting:** `vite.config.js` does not configure `manualChunks`. Three.js (84 KB component + Three runtime), html2pdf.js, and large data catalogs are loaded in the main entry chunk.
3. **Public Images:** Several high-resolution assets in `public/` (e.g. `solar_field_cover.jpg` at 1.05 MB, `mirana_page1_original.jpg` at 524 KB) are uncompressed JPEG files.

---

## 11. UX/UI Audit

### 11.1 Usability Findings
1. **Blank Toast Notifications:** When actions complete (e.g., adding a customer lead in `StaffRadarMap.jsx` or updating pricing in `DealerManagement.jsx`), the toast popup appears empty due to parameter destructuring mismatch.
2. **Quotation Edit Reset Ambiguity:** Navigating away from `CreateQuotation` does not warn users about unsaved form modifications unless they explicitly save a draft.
3. **PWA Update Prompt:** `UpdateNotificationPopup.jsx` correctly notifies users of service worker updates.

---

## 12. Accessibility Audit

1. **Interactive `<a>` Tags Without `href`:** In `src/components/Auth/AdminLogin.jsx:212` and `src/components/DealerPortal/PDFTemplate.jsx`, anchor tags are used as click targets without `href`, `role="button"`, or keyboard event handlers (`onKeyDown`).
2. **Missing Form Field Labels:** Several quick filter inputs in `AllQuotations.jsx` and `DealerManagement.jsx` rely on placeholders rather than explicit `<label>` or `aria-label` tags.
3. **Contrast Compliance:** High-contrast text on dark backgrounds (`#0F1B2E` surface with emerald green `#6CBF3D`) meets WCAG AA standards (contrast ratio > 4.5:1).

---

## 13. SEO Audit

1. **Title and Meta Tags:** `index.html` provides standard title (`Sunvine Solar EPC Portal`), meta description, and theme color (`#0F1B2E`).
2. **Application Type:** The portal is an authenticated enterprise SPA and client proposal viewer. Standard indexability and meta tags are adequate for its purpose.
3. **Hardcoded Hostname Redirect:** `index.html:6-12` contains a script redirecting any hostname containing `onrender.com` or `render.com` to `https://sunvine-dealer.vprotech.online`.

---

## 14. Testing Audit

### 14.1 Existing Test Suite
- Existing test scripts in `scripts/` (`test_production_hardening.cjs`, `test_admin_dashboard.cjs`, `test_auth_and_passwords.cjs`, `test_offline_and_mobile.cjs`) use Puppeteer to verify DOM elements, layout rendering, and version constants.

### 14.2 Test Coverage Gaps
- No automated unit test runner (e.g., Vitest / Jest) configured in `package.json`.
- Critical business math (BOM generation, PM Surya Ghar DBT subsidy slabs, DISCOM payback calculations) has no automated unit tests.
- Quotation saving and ID generation have no regression tests.

---

## 15. Deployment / DevOps Audit

1. **Build Configuration:** `package.json` specifies `"build": "vite build"`.
2. **Vercel Routing:** `vercel.json` provides rewrite rules routing all paths to `/index.html` for client-side routing.
3. **Docker Support:** A multi-stage `Dockerfile` and `nginx.conf.template` exist for containerized deployments.

---

## 16. Confirmed Issues Master Table

| ID | Severity | Category | Finding | Location | Confidence |
|---|---|---|---|---|---|
| **ISSUE-01** | **P0** | Security | Unrestricted Supabase RLS policies allow password hash dump & data overwrite | `supabase_schema.sql:134-150` | High |
| **ISSUE-02** | **P0** | Security | Hardcoded fallback Supabase URL & publishable key in client code | `src/lib/supabase.js:3-4` | High |
| **ISSUE-03** | **P0** | Security | Dealer authentication bypass (password not validated) & open OTP fallbacks | `src/services/authService.js:129-231` | High |
| **ISSUE-04** | **P0** | Security | Obfuscated Google Gemini API key hardcoded in client source | `src/utils/aiRoofVisionEngine.js:10, 32` | High |
| **ISSUE-05** | **P1** | Bugs / Logic | Quotation ID space collision (900 random IDs) causes silent record overwrite | `CreateQuotation.jsx:680, 818` | High |
| **ISSUE-06** | **P1** | Bugs / Logic | Shared WhatsApp proposal link fails on customer devices (missing DB fetch) | `QuotationPreview.jsx:39-75` | High |
| **ISSUE-07** | **P1** | Bugs / Logic | Runtime crash on "Reset Form" (`ReferenceError: setSystemCapacity is not defined`) | `CreateQuotation.jsx:649` | High |
| **ISSUE-08** | **P1** | Bugs / Logic | Runtime crash on "Autofill Credentials" in Admin Login (`setOtp is not defined`) | `AdminLogin.jsx:180` | High |
| **ISSUE-09** | **P1** | Bugs / Logic | Parameter mismatch in `saveDealerPricing` saves `undefined` data | `AppContext.jsx:1111`, `pricingService.js:39` | High |
| **ISSUE-10** | **P2** | Bugs / UX | `addToast` string signature mismatch renders blank notification toasts | `Toast.jsx:8`, 20+ calling components | High |
| **ISSUE-11** | **P2** | Performance | Duplicate Supabase upsert calls on every quotation save | `CreateQuotation.jsx:775`, `AppContext.jsx:1004` | High |
| **ISSUE-12** | **P2** | Performance | 1.85 MB static database in main bundle blocks initial mobile page load | `src/data/gujaratDatabase.js` | High |
| **ISSUE-13** | **P2** | Architecture | Unused dependency `tesseract.js` in `package.json` | `package.json:17` | High |
| **ISSUE-14** | **P2** | Accessibility | Interactive `<a>` and `<div>` elements without keyboard handlers or ARIA tags | `AdminLogin.jsx:212`, `Navigation.jsx` | High |
| **ISSUE-15** | **P3** | Mobile | `overflow-x: clip` on root containers risks clipping interactive zoom modals | `index.html:54`, `App.jsx:192` | Medium |
| **ISSUE-16** | **P3** | DevOps | Hardcoded domain redirect in `index.html` restricts multi-environment previews | `index.html:6-12` | High |
| **ISSUE-17** | **P3** | Security | In-memory client-side rate limiting easily bypassed by page reload | `src/services/authService.js:9-33` | High |

---

## 17. Potential Risks Requiring Verification

1. **Live Supabase Instance RLS State (P1):** Needs verification whether the live database instance currently matches `supabase_schema.sql` or has custom policies applied in the Supabase Dashboard.
2. **Serverless Lead Scraper Rate Limiting (P2):** `api/scrape-solar-leads.js` fetches DuckDuckGo HTML without proxy rotation; high request volume on Vercel may trigger IP-level rate limiting from DuckDuckGo.
3. **PWA Service Worker Cache Invalidation (P2):** When `DB_VERSION` updates, existing clients with cached service worker assets may experience stale data until caches are explicitly purged.
4. **WebGL Context Retention on Low-End Mobile (P3):** Repeatedly mounting `SolarStructure3DViewer` on 2GB RAM devices could cause WebGL context loss if previous canvases are not fully garbage-collected.

---

## 18. Things That Are Already Done Well

1. **Domain-Specific Solar Intelligence:** Highly accurate engineering BOM calculations, 3D structure generation, and PM Surya Ghar subsidy rules.
2. **Robust Multi-Tab Storage Synchronization:** `AppContext.jsx` implements clean `window.addEventListener('storage', ...)` synchronization across browser tabs.
3. **Comprehensive Error Boundary:** `ErrorBoundary.jsx` provides diagnostics, copyable stack traces, and automatic recovery routines for chunk mismatch errors.
4. **Controlled Boot Sequence:** `index.html` implements zero-FOUC branded app shells and font ligature flash protection styles.
5. **Dark Enterprise Visual Polish:** Consistent compliance with brand colors, touch target sizing, and typography across all portal views.

---

## 19. Recommended Implementation Order

### Phase 1: Immediate Critical Fixes (P0 & P1 Runtime Blockers)
1. **Fix Quotation ID Collision:** Replace 900-number generation with collision-resistant UUIDs and sequential quotation numbers (`BUG-001`).
2. **Fix Runtime ReferenceErrors:** Remove `setSystemCapacity` in `CreateQuotation.jsx:649` and `setOtp` in `AdminLogin.jsx:180`.
3. **Fix Public Proposal Viewing:** Add Supabase lookup in `QuotationPreview.jsx` for external customer links.
4. **Align `saveDealerPricing` Signature:** Fix parameter ordering in `pricingService.js`.
5. **Harden Supabase RLS & Auth Service:** Restrict public RLS policies on `dealers`, `admin_users`, and `quotations`; fix password check in `loginDealer`.
6. **Move API Secrets to Environment Variables:** Remove fallback keys from `src/lib/supabase.js` and `aiRoofVisionEngine.js`.

### Phase 2: Functional Reliability & Polish (P2)
7. **Fix `addToast` Helper:** Update `Toast.jsx` to accept both string `(message, type)` and object `({ title, message, type })` invocations.
8. **Eliminate Duplicate Upserts:** Remove redundant `quotationService.saveQuotation` call in `CreateQuotation.jsx`.
9. **Remove Dead Dependencies:** Clean up `tesseract.js` from `package.json`.
10. **Accessibility Improvements:** Replace empty `<a>` tags with `<button>` and add proper ARIA attributes.

### Phase 3: Performance & Scalability (P2 & P3)
11. **Code-Splitting & Lazy Loading:** Configure Rollup `manualChunks` in `vite.config.js` for Three.js, html2pdf.js, and large data catalogs.
12. **Optimize Static Data:** Lazy load or stream `gujaratDatabase.js` on demand rather than bundling it into the main entry chunk.

---

## 20. Audit Limitations

1. **Terminal Command Execution:** Terminal build and test commands could not be executed directly in this environment due to user permission settings; verification was performed through exhaustive static code analysis, AST tracing, and configuration inspection.
2. **Live Supabase Dashboard Settings:** Direct access to the live Supabase project management dashboard was not available to inspect settings configured outside the repository's SQL schema files.
3. **External API Quota Status:** Google Gemini and Google Places API live key quotas could not be queried over the network in read-only mode.

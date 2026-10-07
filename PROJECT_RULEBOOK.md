# Sunvine Renewable Energy — Master Engineering & Architecture Rule Book

> **Status**: Permanent, Mandatory & Immutable Project Standard  
> **Applicability**: Super Admin Portal, Dealer Portal, Staff Portal, Serverless Handlers (`api/`), Shared Services, Contexts, Hooks, Component Architecture & Database Operations.  
> **Enforcement**: Strict enforcement for all AI coding assistants, human developers, subagents, and git commits.

---

## Table of Contents
1. [Rule 1: Direct Database First & Schema Integrity (Top Priority)](#rule-1-direct-database-first--schema-integrity-top-priority)
2. [Rule 2: Adversarial Backend Security, Password Hashing & Zero Hardcoded Secrets](#rule-2-adversarial-backend-security-password-hashing--zero-hardcoded-secrets)
3. [Rule 3: Cross-Touchpoint Fullstack Consistency](#rule-3-cross-touchpoint-fullstack-consistency)
4. [Rule 4: Senior Fullstack Architecture & Pre-Execution Planning (/plan)](#rule-4-senior-fullstack-architecture--pre-execution-planning-plan)
5. [Rule 5: Zero Hardcoding & Dynamic Entity/Category Extensibility](#rule-5-zero-hardcoding--dynamic-entitycategory-extensibility)
6. [Rule 6: UI Continuity, Brand Aesthetics & Ultra-Smooth Performance](#rule-6-ui-continuity-brand-aesthetics--ultra-smooth-performance)
7. [Rule 7: Non-Blocking Workflows & Document Policies](#rule-7-non-blocking-workflows--document-policies)
8. [Rule 8: Authentic Real-World Telemetry & Geolocation](#rule-8-authentic-real-world-telemetry--geolocation)
9. [Rule 9: Pragmatic Package & Dependency Management](#rule-9-pragmatic-package--dependency-management)
10. [Rule 10: Git Hygiene, sumit-updates Branch & 0-Error Build Verification](#rule-10-git-hygiene-sumit-updates-branch--0-error-build-verification)

---

## Rule 1: Direct Database First & Schema Integrity (Top Priority)

### 1.1 Direct Database Single Source of Truth (Zero Cache-Only / Zero LocalStorage-Only Data)
- **STRICT REQUIREMENT ACROSS ALL BRANCHES**: Regardless of branch (`sumit-updates`, `devlopment`, etc.), any entity created, edited, updated, or deleted anywhere in this project MUST be written directly to the database (Supabase / PostgreSQL) via backend APIs or dedicated database services.
- **Universal Scope**: Includes user accounts, staff, dealers, material items, hardware, pricing matrices, custom categories, units, customer leads, quotations, BOM items, audit logs, and system settings.
- Data MUST NEVER be stored exclusively in browser memory, React state, or `localStorage`.

### 1.2 Direct Database Fetch on Mount & Hard Refresh
- The database is the **Sole Single Source of Truth**.
- On initial portal boot, tab switch, route navigation, and especially upon a **hard refresh** (`Ctrl + Shift + R` or `F5`), the application MUST fetch active, live records directly from the database.
- Data must NEVER disappear, desynchronize, or revert to blank / stale mock data after a hard browser reload.
- `localStorage` is strictly restricted to ephemeral UI preferences (like collapsed sidebar state) and active session tokens. Business data must never depend on it.

### 1.3 Pre-Implementation Database Schema Analysis
- When introducing ANY new feature, the engineer/AI must first inspect the existing database schema.
- If the feature requires new fields, relations, or tables, design and create the appropriate table/column definitions in the database first.
- Never force unstructured data into inadequate columns or rely on frontend-only simulations.

### 1.4 Real Persistence Verification (No Fake or Read-Only Saves)
- Every time a create or update action is built or modified, verify that the data is genuinely written to and saved in the database.
- Check against traps where an input field is marked `readOnly`, unmapped in the payload, missing from the SQL update statement, or ignored by backend DTOs.
- Confirm with direct database verification that the submitted payload actually persists.

---

## Rule 2: Adversarial Backend Security, Password Hashing & Zero Hardcoded Secrets

### 2.1 Mandatory Password Hashing (Zero Plaintext Credentials)
- Passwords MUST ALWAYS be securely hashed (e.g. bcrypt/argon2 / cryptographic hashing) before being saved in the database.
- Plaintext passwords must NEVER be saved to the database, stored in logs, or printed in error responses.

### 2.2 Zero Hardcoded Secrets & Anti-Scanner Compliance
- Never hardcode, commit, or paste API keys, JWT secrets, database connection strings, or service tokens in any git-tracked files.
- All secrets must reside exclusively in `.env` (gitignored) and environment variables.
- In test fixtures and mock datasets, NEVER pair corporate email domains (`@sunvine.in`) with literal `password:` keys (triggers GitGuardian & GitHub Secret Scanning). Use `accessCode: 'dealer123'`, `authPin: '123456'`, or `passcode: '...'`.

### 2.3 Adversarial Backend Architecture (Hacker / Breach-Simulation Mindset)
- Backend APIs (`api/`) must NEVER be weak or vulnerable.
- When designing or modifying any endpoint, think like an attacker trying to hijack or compromise the system:
  1. **SQL / Query Injection**: Ensure parameterized queries and sanitized inputs across all database calls.
  2. **Auth Bypass & Privilege Escalation**: Verify role permissions (`super_admin`, `admin`, `dealer`, `staff`) on every backend route. Never trust client-claimed roles.
  3. **Broken Object-Level Authorization (IDOR)**: Ensure users can only read/mutate records belonging to their authorized scope or tenancy.
  4. **Payload Tampering**: Validate and sanitize all request body properties.
- **Protocol**: Actively probe the backend for security breaches during development. Once potential vulnerabilities are identified, patch them immediately, and then re-test to confirm breach resistance.

---

## Rule 3: Cross-Touchpoint Fullstack Consistency

### 3.1 Global Entity Rule Propagation
- If an entity requirement, validation rule, or field is added, modified, made mandatory, or removed (e.g. "make address mandatory for dealers" or "remove field X from profile"):
  - You MUST identify and update **ALL** locations across the entire project where that entity is created, edited, viewed, or processed.
  - *Example*: If dealer creation requires a mandatory address, that validation must be applied in Settings > Account, Dealer Partners tab, Admin Portal modals, Staff Portal, and backend registration APIs.
- Never implement a field change only on the single screen mentioned in the user's prompt while leaving other forms, modals, or sibling tabs broken or inconsistent.

### 3.2 Synchronized Frontend & Backend Validation
- Field validations (mandatory checks, regex formats, length constraints) must exist identically on both the frontend UI and the backend API handler.

---

## Rule 4: Senior Fullstack Architecture & Pre-Execution Planning (/plan)

### 4.1 Plan Before Execution
- Before implementing features or making structural modifications, formulate a thorough technical plan (`/plan`) as a Senior Frontend and Backend Architect.
- Do not just mindlessly or superficially execute single-line prompt instructions. Analyze the end-to-end architecture: Database -> Serverless Backend -> API Handler -> State Management -> UI Components.

### 4.2 Proactive Architectural Ownership
- Identify edge cases, missing error boundaries, concurrency bottlenecks, and integration points proactively.
- If a user requests a feature, think two steps ahead to ensure full architectural harmony.

---

## Rule 5: Zero Hardcoding & Dynamic Entity/Category Extensibility

### 5.1 Dynamic Data Over Hardcoding
- Never hardcode business logic, pricing matrices, category lists, unit options, or DISCOM tariffs in component render blocks or static arrays.
- Distance filters, lead categories, pricing tiers, and hardware items must be dynamic and driven by data tables or settings.

### 5.2 Mandatory Dynamic Category & Option Management
- If a feature is implemented that introduces an entity with categories, units, or classifications (e.g., items, hardware, inventory, materials):
  - You MUST automatically provide dynamic category/unit creation and management options, even if the user did not explicitly mention it.
  - The user/admin must be able to add, edit, and select new categories directly from the UI without requiring code changes.

### 5.3 Future-Proof Admin Controls
- When creating any major feature, expose necessary configuration and role permissions in the appropriate admin or settings panel so that future tweaks do not necessitate code changes.

---

## Rule 6: UI Continuity, Brand Aesthetics & Ultra-Smooth Performance

### 6.1 Brand Identity & Color Integrity
- The Sunvine brand palette is immutable:
  - **Dark Enterprise Console**: `#0D1527` (card background) and `#070D18` (deep background).
  - **Energy Accent**: Emerald / Teal gradient (`from-emerald-600 to-teal-500`, `hover:from-emerald-500 hover:to-teal-400`).
  - **Surface & Container**: Tailwind `bg-surface`, `bg-surface-container`, `border-surface-container-high`.
  - **Typography**: `Inter` (body font), `Space Grotesk` (display/headlines), and `Roboto Mono` (numeric kW, currency, coordinates, phone numbers).
  - **Icons**: Google `material-symbols-outlined` with standard sizing (`text-[16px]`, `text-[18px]`, `text-[22px]`).

### 6.2 UI/UX Pro Max Ergonomics
- `cursor-pointer` on every interactive button, chip, tab, and clickable row.
- Touch targets >= 44×44px for field technicians and mobile devices.
- Text contrast ratio >= 4.5:1.
- All flex children with text must have `min-w-0` to support clean `truncate`.
- Responsive across all viewports (360px to 1920px) with **zero horizontal root overflow**.

### 6.3 Ultra-Smooth, Fully Optimized Performance
- Both frontend and backend must be ultra-fast and fully optimized.
- Eliminate unnecessary re-renders, debounce intensive inputs, memoize heavy computations, and ensure zero UI lag.
- The user experience must feel instant, fluid, and enterprise-grade.

---

## Rule 7: Non-Blocking Workflows & Document Policies

### 7.1 Non-Mandatory Document Uploads
- Solar technicians and sales field staff in the field often perform site surveys before collecting customer documents.
- **RULE**: Document upload (Aadhaar Card, Light Bill, Meter Photo, Site Photo, Bank Passbook) must NEVER be mandatory to create, save, or edit a Customer Lead or generate a Solar Quotation.
- Customer Files must save successfully in `Sourced` / `Survey Scheduled` stage with 0 documents uploaded.
- The UI should clearly show document upload progress (e.g. `2/5 Docs Uploaded`), but NEVER block the user from proceeding with a hard validation error.

---

## Rule 8: Authentic Real-World Telemetry & Geolocation

### 8.1 Zero Synthetic / Hallucinated Data in Production
- When fetching solar EPCs, dealers, installers, or shops:
  - NEVER fabricate fake telephone numbers (e.g., `+91 99999 99999`), random coordinates, or fictional business names.
  - If a company's phone number or website is unlisted, explicitly display `"Phone unlisted"` or `"Website unlisted"`.
  - Every lead must contain genuine Google Maps deep navigation links.

### 8.2 High-Accuracy Hardware Geolocation & Race Guards
- Invoke HTML5 Geolocation with `{ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }`.
- Update search centers only when the user moves more than **35 meters** to conserve battery and API limits.
- Implement `activeRequestId` / `AbortController` to prevent stale coordinate responses from overwriting newer queries.
- Provide a **"Pick Manual Spot"** interactive button for desktop users without GPS hardware.

---

## Rule 9: Pragmatic Package & Dependency Management

### 9.1 Genuine Dependency Allowance
- When a package is genuinely required to implement a robust feature, secure cryptography (e.g., password hashing), PDF generation, or barcode/image handling, install it cleanly via `npm`.
- Ensure new packages are vetted, secure, and actively maintained.
- Avoid redundant or duplicate packages where existing dependencies or standard library features already suffice.

---

## Rule 10: Git Hygiene, sumit-updates Branch & 0-Error Build Verification

### 10.1 Dedicated Branch Deployment Protocol
- All development, feature updates, commits, and pushes MUST be made to the **`sumit-updates`** branch on GitHub / Vercel.
- **NEVER push directly to the `main` branch**. Merging into `main` (Production) requires explicit confirmation from the user.

### 10.2 Mandatory Build Quality Gate
- Before staging and committing any change:
  - Run `npm run build` locally.
  - The build MUST succeed with **0 errors**.
  - Any JSX syntax errors, missing imports, unclosed tags, or unhandled exceptions must be resolved before pushing.

### 10.3 Zero Dead Code in Repository
- Clean up all test scripts, temporary dump files (`test-*.js`, `inspect-*.json`), and commented-out code blocks before committing.

---

## Enforcement Checklist for Every Change

- [ ] **Direct DB Persistence & Live Fetch (Rule 1)**: All added/updated data writes directly to the DB and is fetched directly from the DB so hard refresh never causes data loss. Verified schema and confirmed no fake/read-only saves.
- [ ] **Adversarial Backend Security (Rule 2)**: Passwords hashed with secure crypto. No hardcoded secrets or API keys. Backend checked with hacker mindset for IDOR, SQL injection, and auth bypass.
- [ ] **Cross-Touchpoint Consistency (Rule 3)**: Entity field changes applied across all forms, tabs, modals, and APIs project-wide.
- [ ] **Senior Fullstack Architecture (Rule 4)**: Thorough technical plan formulated and reviewed before code modification.
- [ ] **Dynamic & Extensible (Rule 5)**: Zero hardcoding; dynamic category and unit management provided for new entities.
- [ ] **UI Continuity & Brand Intact (Rule 6)**: Dark enterprise theme (`#0D1527`), emerald/teal gradients, smooth performance, 0 horizontal overflow.
- [ ] **Non-Blocking Docs (Rule 7)**: Customer files and quotes save without mandatory document uploads.
- [ ] **Data Authenticity (Rule 8)**: All leads and coordinates genuine with real distance calculations.
- [ ] **Pragmatic Dependencies (Rule 9)**: Necessary packages installed properly without bloat.
- [ ] **sumit-updates Branch & Clean Build (Rule 10)**: Executed `npm run build` with 0 errors. Pushing strictly to `sumit-updates`.

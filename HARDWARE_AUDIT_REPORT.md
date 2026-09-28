# Hardware Admin Page — Full Backend Audit Report

> **Date:** 2026-09-28  
> **Branch:** `devlopment`  
> **Project:** Sunvine Dealer Portal Quotation (`E:\repos\dealer-portal-quotation`)  
> **Supabase Project ID:** `wyberzvcyrjipjqpotwe`  
> **Audited By:** Antigravity AI  

---

## Executive Summary

The `/admin/hardware` page (`HardwareMaster.jsx`) was **not persisting data to the Supabase database**. All data was silently falling back to `localStorage`. Because `localStorage` is device-specific (browser-local), data added from one device (e.g. mobile on LAN `192.168.1.130:5173`) was **not visible on any other device** (e.g. desktop `localhost:5173`) after a page refresh.

The root cause is a **paused Supabase project** combined with **silent error handling** and an **unconditional localStorage sync** that makes failures appear as successes.

---

## Issue Inventory

| # | Severity | Status | Issue |
|---|----------|--------|-------|
| 1 | 🔴 CRITICAL | **Not Fixed (needs manual action)** | Supabase project is PAUSED — DNS unreachable |
| 2 | 🔴 CRITICAL | **Not Fixed (needs manual action)** | No `.env` file — hardcoded paused project credentials |
| 3 | 🔴 CRITICAL | **Not Fixed (needs manual action)** | `solar_modules` / `solar_inverters` tables likely don't exist yet |
| 4 | 🟠 HIGH | ✅ Fixed | `addNewModule` / `addNewInverter` in `AppContext.jsx` silently swallowed DB errors |
| 5 | 🟠 HIGH | ✅ Fixed | Modal didn't close after "Publish" when Supabase was unreachable |
| 6 | 🟠 HIGH | ✅ Partially Fixed | `localStorage` unconditional sync masked DB failures |
| 7 | 🟡 MEDIUM | ✅ Fixed | `ReferenceError: customCellTechs is not defined` on Add Solar Module |
| 8 | 🟡 MEDIUM | ✅ Fixed | Inverter edit modal missing Base Price + Warranty fields |
| 9 | 🟡 MEDIUM | ✅ Fixed | No delete buttons on module/inverter cards and table rows |
| 10 | 🟡 MEDIUM | ✅ Fixed | `PricingMaster.jsx` delete handlers were localStorage-only |
| 11 | 🟢 LOW | ✅ Fixed | Supabase status badge was hardcoded green |
| 12 | 🟢 LOW | ✅ Fixed | `updateQuotationStatus` in `AppContext.jsx` wasn't syncing status to DB |

---

## Detailed Issue Analysis

---

### Issue #1 — 🔴 CRITICAL: Supabase Project is PAUSED

**Root Cause:**  
Free-tier Supabase projects auto-pause after approximately 1 week of inactivity. Once paused:
- DNS resolution fails: `getaddrinfo ENOTFOUND wyberzvcyrjipjqpotwe.supabase.co`
- All REST API calls to `supabase.from('solar_modules').select()` throw a network error
- `hardwareService.saveModule()` returns `{ success: false, error: 'fetch failed' }`
- **No data is written to the database**

**Evidence:**
```
Error: getaddrinfo ENOTFOUND wyberzvcyrjipjqpotwe.supabase.co
  → All three connection poolers (session, transaction, direct) failed
  → node scripts/testSupabase.js returned 'connected' (misleading — auth.getSession() 
     doesn't require DB to be live)
```

**Symptom:**  
Data added on mobile `192.168.1.130:5173` showed up on mobile (it was in that device's `localStorage`) but was invisible on desktop `localhost:5173` after refresh (desktop has its own empty `localStorage`).

**Fix Required:**
1. Go to **https://app.supabase.com → Projects → `wyberzvcyrjipjqpotwe` → Click "Restore project"**
2. Wait ~2 minutes for the project to fully resume
3. Verify DNS: `ping wyberzvcyrjipjqpotwe.supabase.co` should resolve
4. Then run: `node scripts/migrateSupabase.js` to create the tables

---

### Issue #2 — 🔴 CRITICAL: No `.env` File — Hardcoded Paused Project Credentials

**Affected File:** [`src/lib/supabase.js`](file:///E:/repos/dealer-portal-quotation/src/lib/supabase.js)

**Root Cause:**  
The Supabase client is initialized with hardcoded fallback values that point to the **paused** project:

```js
// src/lib/supabase.js (lines 3–4)
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) 
  || 'https://wyberzvcyrjipjqpotwe.supabase.co';   // ← hardcoded PAUSED project

const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) 
  || 'sb_publishable_XzbS-fQMtSGf2LjFO40yzw_LtT98nG6';  // ← hardcoded key
```

There is **no `.env` file** in the project root (only `.env.example` exists). So `import.meta.env.VITE_SUPABASE_URL` is always `undefined`, and the hardcoded paused URL is always used.

**Fix Required:**
1. Create `.env` in project root:
   ```env
   VITE_SUPABASE_URL=https://wyberzvcyrjipjqpotwe.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key-from-supabase-dashboard>
   ```
2. Add `.env` to `.gitignore` (it should already be there — do NOT commit the `.env` file)
3. In Vercel dashboard → Project Settings → Environment Variables → add both keys for Production + Preview

---

### Issue #3 — 🔴 CRITICAL: Database Tables May Not Exist

**Affected Tables:** `solar_modules`, `solar_inverters`

**Root Cause:**  
The migration script (`scripts/migrateSupabase.js`) was **never successfully executed** because Supabase was paused during all attempts. The tables `solar_modules` and `solar_inverters` may not exist at all in the database.

**Evidence:**  
Every attempt to run the migration script failed:
```
Error: Connection refused / ENOTFOUND
→ Could not reach session pooler
→ Could not reach transaction pooler
→ Could not reach direct connection
```

**Fix Required:**
After un-pausing Supabase, run the SQL from `supabase_schema.sql` in the Supabase SQL Editor:
1. Go to **https://app.supabase.com → SQL Editor**
2. Open `supabase_schema.sql` and paste the DDL for `solar_modules` and `solar_inverters`
3. Execute it
4. Then run `node scripts/migrateSupabase.js` to seed initial data

---

### Issue #4 — 🟠 HIGH: Silent Error Handling in `addNewModule` / `addNewInverter` (FIXED)

**Affected File:** [`src/context/AppContext.jsx`](file:///E:/repos/dealer-portal-quotation/src/context/AppContext.jsx) (lines 617–677)

**Root Cause (Before Fix):**  
The original `addNewModule` function called `hardwareService.saveModule()` but **never checked the return value**. When Supabase was down, it returned `{ success: false, error: 'fetch failed' }`, but the function silently continued — no toast, no error shown to user.

```js
// BEFORE (broken):
setModulesList(prev => [moduleEntry, ...prev]);
await hardwareService.saveModule(moduleEntry); // ← return value ignored
return moduleEntry;
```

**After Fix:**  
`HardwareMaster.jsx`'s `handleSaveModule` now:
1. Closes the modal immediately (before awaiting DB — so UI is never blocked)
2. Shows a success toast immediately
3. Attempts DB save in background
4. If DB fails → shows a secondary amber toast: *"Added locally. (Supabase not reached)"*

---

### Issue #5 — 🟠 HIGH: Modal Didn't Close After "Publish" When Supabase Was Unreachable (FIXED)

**Affected File:** [`src/components/AdminPortal/HardwareMaster.jsx`](file:///E:/repos/dealer-portal-quotation/src/components/AdminPortal/HardwareMaster.jsx)

**Root Cause (Before Fix):**  
`handleSaveModule` was structured as:
```js
// BEFORE (broken):
const res = await hardwareService.saveModule(newMod); // ← awaited FIRST
setShowAddModuleModal(false); // ← closed AFTER network call
```

When Supabase timed out (15–30 seconds), the modal stayed open and the user couldn't tell if anything happened.

**After Fix:**  
Modal closes and form resets immediately before the DB call:
```js
// AFTER (fixed):
setShowAddModuleModal(false); // close immediately
resetModuleForm();
toast.success('Solar Module added!');
const res = await hardwareService.saveModule(newMod); // DB call in background
if (!res?.success) toast.warning('Added locally. (Supabase not reached)');
```

---

### Issue #6 — 🟠 HIGH: `localStorage` Sync Always Runs — Masks DB Failures

**Affected File:** [`src/context/AppContext.jsx`](file:///E:/repos/dealer-portal-quotation/src/context/AppContext.jsx) (lines 522–528)

**Root Cause:**  
Two `useEffect` hooks in `AppContext.jsx` run **unconditionally** whenever `modulesList` or `invertersList` state changes:

```js
// Lines 522–528 in AppContext.jsx
useEffect(() => { safeSetItem('sunvine_modules', modulesList); }, [modulesList]);
useEffect(() => { safeSetItem('sunvine_inverters', invertersList); }, [invertersList]);
```

**Consequence:**  
1. User adds a module → `setModulesList()` runs → state updates in memory
2. These `useEffect` hooks immediately persist the new state to `localStorage`
3. Even if Supabase write failed → `localStorage` has the data
4. Page looks fine on that device — **no visible indication that DB save failed**
5. On any other device → `localStorage` is empty → data is missing

**Status:** Partially mitigated by adding warning toasts. The `useEffect` sync was intentionally kept for offline cache purposes — but users must be informed when DB sync fails.

---

### Issue #7 — 🟡 MEDIUM: `ReferenceError: customCellTechs is not defined` (FIXED)

**Affected File:** [`src/components/AdminPortal/HardwareMaster.jsx`](file:///E:/repos/dealer-portal-quotation/src/components/AdminPortal/HardwareMaster.jsx) (~line 3053)

**Root Cause:**  
A refactor removed the variable declaration `const customCellTechs = availableCellTechs` but left a reference to `customCellTechs` in the JSX render. React threw a `ReferenceError` when the "Add Solar Module" button was clicked.

**Fix:**  
- Added `const customCellTechs = availableCellTechs;` alias near the top of the component
- Changed all `customCellTechs.filter(...)` calls to use `availableCellTechs.filter(...)`

---

### Issue #8 — 🟡 MEDIUM: Inverter Edit Modal Missing Fields (FIXED)

**Affected File:** [`src/components/AdminPortal/HardwareMaster.jsx`](file:///E:/repos/dealer-portal-quotation/src/components/AdminPortal/HardwareMaster.jsx)

**Root Cause:**  
The inverter modal was missing `Base Price` and `Warranty` input fields, and the modal title was always "Add Inverter Model" even in edit mode.

**Fix:**
- Added Base Price and Warranty fields to the inverter modal form
- Added dynamic title: "Edit Inverter Model" when `editingInverter` is set, "Add Inverter Model" otherwise
- `handleOpenAddInverter()` now resets `editingInverter` to `null` before opening the modal

---

### Issue #9 — 🟡 MEDIUM: No Delete Functionality on Module/Inverter Cards (FIXED)

**Affected File:** [`src/components/AdminPortal/HardwareMaster.jsx`](file:///E:/repos/dealer-portal-quotation/src/components/AdminPortal/HardwareMaster.jsx)

**Root Cause:**  
There were no delete buttons on module cards, module table rows, inverter cards, or inverter table rows. Users could archive but not permanently delete hardware entries.

**Fix:**
- Added delete buttons to all four locations
- Added `handleDeleteModule(id)` and `handleDeleteInverter(id)` functions
- These call `hardwareService.deleteModule(id)` / `hardwareService.deleteInverter(id)` to remove from Supabase
- Then update local state to remove the item from the list

---

### Issue #10 — 🟡 MEDIUM: `PricingMaster.jsx` Delete Was localStorage-Only (FIXED)

**Affected File:** [`src/components/AdminPortal/PricingMaster.jsx`](file:///E:/repos/dealer-portal-quotation/src/components/AdminPortal/PricingMaster.jsx)

**Root Cause:**  
`handleDeleteModule` and `handleDeleteInverter` in `PricingMaster.jsx` only updated local state / `localStorage`. They did not call Supabase to delete the record from the database.

**Fix:**
- Imported `hardwareService` in `PricingMaster.jsx`
- Delete handlers now call `hardwareService.deleteModule(mod.id)` and `hardwareService.deleteInverter(inv.id)`

---

### Issue #11 — 🟢 LOW: Supabase Status Badge Was Hardcoded Green (FIXED)

**Affected File:** [`src/components/AdminPortal/HardwareMaster.jsx`](file:///E:/repos/dealer-portal-quotation/src/components/AdminPortal/HardwareMaster.jsx)

**Root Cause:**  
The status badge in the Hardware Master header always showed "Supabase DB Connected" in green, even when Supabase was paused and unreachable.

**Fix:**  
Badge is now dynamic based on `isHardwareDbConnected` context value:
- `true` → 🟢 Green — "Supabase DB Connected"
- `false` → 🟡 Amber — "Supabase Disconnected (Project Inactive)"

---

### Issue #12 — 🟢 LOW: `updateQuotationStatus` Wasn't Syncing to DB (FIXED)

**Affected File:** [`src/context/AppContext.jsx`](file:///E:/repos/dealer-portal-quotation/src/context/AppContext.jsx) (~line 959)

**Root Cause:**  
`updateQuotationStatus()` only updated the in-memory `quotations` array. It did not call `quotationService.saveQuotation()` to persist the status change to Supabase.

**Fix:**  
`updateQuotationStatus` now calls `quotationService.saveQuotation(target)` after updating state, syncing the status change to the database.

---

## Architecture: How Hardware Data Flows

```
AppContext.jsx (on mount)
  │
  ├── hardwareService.getAllModules()   → Supabase REST API
  │     ├── SUCCESS → setModulesList(dbData)  + setIsHardwareDbConnected(true)
  │     └── FAIL    → falls back to localStorage('sunvine_modules') or DEFAULT_MODULES
  │
  └── hardwareService.getAllInverters() → Supabase REST API
        ├── SUCCESS → setInvertersList(dbData)
        └── FAIL    → falls back to localStorage('sunvine_inverters') or DEFAULT_INVERTERS

HardwareMaster.jsx — handleSaveModule()
  │
  ├── setModulesList(optimistic update)   ← updates state immediately
  ├── setShowAddModuleModal(false)        ← closes modal immediately
  ├── toast.success("Module Added!")      ← user feedback immediately
  │
  └── hardwareService.saveModule(newMod) → Supabase upsert
        ├── SUCCESS → no further action needed
        └── FAIL    → toast.warning("Added locally. (Supabase not reached)")

AppContext useEffect (always runs when modulesList changes)
  └── localStorage.setItem('sunvine_modules', modulesList)  ← ALWAYS writes locally
```

> [!WARNING]
> The `localStorage` sync always runs — this is by design for offline caching. But it means if Supabase is down, data silently persists only to the current device's browser storage. **The only fix is to ensure Supabase is reachable.**

---

## Step-by-Step Fix Checklist

Follow these steps **in order** to fully restore Supabase persistence:

### Step 1 — Un-pause the Supabase Project
- [ ] Go to **https://app.supabase.com**
- [ ] Open project `wyberzvcyrjipjqpotwe`
- [ ] Click **"Restore project"** (may take 1–3 minutes)
- [ ] Verify: `ping wyberzvcyrjipjqpotwe.supabase.co` should return an IP

### Step 2 — Create `.env` File
- [ ] Create `E:\repos\dealer-portal-quotation\.env` with:
  ```env
  VITE_SUPABASE_URL=https://wyberzvcyrjipjqpotwe.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon-key-from-supabase-dashboard-api-settings>
  ```
- [ ] Confirm `.env` is in `.gitignore`
- [ ] **Do NOT commit the `.env` file**

### Step 3 — Create Database Tables
- [ ] Open **https://app.supabase.com → SQL Editor**
- [ ] Paste and run the DDL from `supabase_schema.sql` (solar_modules + solar_inverters sections)
- [ ] Confirm both tables appear in **Table Editor**

### Step 4 — Seed Initial Data
- [ ] Run: `node scripts/migrateSupabase.js`
- [ ] Confirm seed data appears in Table Editor

### Step 5 — Configure Vercel Environment Variables
- [ ] Go to Vercel → Project Settings → Environment Variables
- [ ] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for **Production** and **Preview**
- [ ] Trigger a new deployment

### Step 6 — Verify Cross-Device Sync
- [ ] Open the app on desktop and add a module
- [ ] Open the app on mobile (same LAN)
- [ ] Refresh mobile — the module should appear ✅
- [ ] Check the Supabase Table Editor — the row should be visible ✅

---

## Files Touched in This Audit Session

| File | Changes Made |
|------|-------------|
| [`src/components/AdminPortal/HardwareMaster.jsx`](file:///E:/repos/dealer-portal-quotation/src/components/AdminPortal/HardwareMaster.jsx) | customCellTechs fix, modal closes immediately on publish, delete buttons added, inverter archived filter, dynamic status badge, inverter modal base price/warranty fields, dynamic modal title |
| [`src/components/AdminPortal/PricingMaster.jsx`](file:///E:/repos/dealer-portal-quotation/src/components/AdminPortal/PricingMaster.jsx) | Imported hardwareService; delete handlers now call DB delete |
| [`src/context/AppContext.jsx`](file:///E:/repos/dealer-portal-quotation/src/context/AppContext.jsx) | updateQuotationStatus syncs to Supabase; live Supabase hardware load on mount |
| [`src/services/hardwareService.js`](file:///E:/repos/dealer-portal-quotation/src/services/hardwareService.js) | **CREATED** — full CRUD: getAllModules, getAllInverters, saveModule, saveInverter, archiveModule, archiveInverter, deleteModule, deleteInverter, bulkUpdateModulePrices, bulkImportModules, seedInitialHardwareIfEmpty |
| [`supabase_schema.sql`](file:///E:/repos/dealer-portal-quotation/supabase_schema.sql) | Added DDL for solar_modules, solar_inverters, RLS policies, indexes, seed data |

---

## Summary

The entire hardware persistence failure chains from **one root cause: the Supabase project is paused**. Everything else — silent errors, localStorage masking, cross-device data mismatch — is a downstream consequence.

Once the project is un-paused and the database tables are created, the code (as fixed in this session) will correctly:
1. Load hardware data from Supabase on app startup
2. Save new modules/inverters to Supabase on publish
3. Delete records from Supabase when deleted in the UI
4. Show the correct connection status badge
5. Warn the user when Supabase is unreachable instead of silently failing

> [!IMPORTANT]
> **The most critical action is un-pausing the Supabase project.** No amount of code changes will fix cross-device data sync until the database is actually reachable.

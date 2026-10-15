# 🔍 PR #5 — Deep Code Audit Report (Hinglish)
**Branch:** `feature/dealer-category` + `devlopment` → `sumit-updates`
**Date:** 10 Oct 2026 | **Author:** Surya Chauhan + Bot commits

---

> [!IMPORTANT]
> Yeh report **PR #5** ka ek complete X-ray hai. Is PR mein **196 files** change hui hain, **31,882 lines add** aur **8,199 lines delete** ki gayi hain. Har section mein — kya badla, kyu badla, aur koi cheez toot toh nahi — sab likha hai.

---

## 📊 PR Ka Overall Summary

| Metric | Value |
|--------|-------|
| Total Files Changed | 196 |
| Lines Added | ~31,882 |
| Lines Deleted | ~8,199 |
| New DB Migrations | 9 (000 se 019 tak) |
| New API Endpoints | `/api/auth/admin-dealers`, `/api/auth/admin-pricing` |
| New React Components | DealerSkeletons, DealerPageParts, AnimatedNumber, DealerAccountsManagement, StaffAccountsManagement |
| New Hooks | `useRealtimeCustomerFiles` |
| New Backend Files | `adminHandlers.js`, `slackSync.js`, `security.js` |
| New Test Files | 13 test files |

**Ek line mein kya badla:** Puri architecture "direct Supabase access" se "Secure API Gateway first, Supabase as fallback" par shift ho gayi. Aur pricing ki sari hardcoding hataake database-driven bana diya gaya.

---

## 📋 Commit List — Kya Kya Kiya Gaya

| Hash | Commit | Summary |
|------|--------|---------|
| `f0e62b8` | Merge PR #5 | Final merge |
| `32e545c` | fix(pricing): try block in saveDealerPricing | Crash guard |
| `e0a8525` | feat(pricing): dealer-specific pricing | New pricing system |
| `7d6c00b` | fix(performance): isolate dealer view | Privacy fix |
| `9869a42` | feat(admin-portal): All Applications directory | New tab add hua |
| `f1c5fa5` | feat(admin-portal): shift DealerMgmt to Settings | Navigation restructure |
| `4a97518` | fix(quotations): persist Active/Sent status | Status bug fix |
| `c30fb96` | fix(dealer-portal): scope MyQuotations | Security fix |
| `6dfcea0` | fix(quotations): ReferenceErrors resolve | Crash fix |
| `ebfe384` | fix(admin-quotations): isFlagged ReferenceError | Loop fix |
| `63cf2c6` | feat(quotation): cover image + GST fix | PDF fix |
| `c82223b` | fix(prelaunch): dealer lifecycle hardening | Multiple fixes |

---

## 🔧 Backend — API Layer Changes

### `api/quotations.js` — ~1,100 Lines Badli

**Status Machine Extend Hua:**

```javascript
// PEHLE — Simple states
admin: {
  Draft: ['Pending', 'Approved', 'Archived'],
  Approved: ['Archived'],
}

// AB — Real-world statuses support karta hai
admin: {
  Draft: ['Pending', 'Approved', 'Rejected', 'Archived', 'Active / Sent', 'Approved / Direct'],
  'Active / Sent': ['Approved', 'Rejected', 'Archived'],
  'Approved / Direct': ['Archived', 'Commissioned'],
  Approved: ['Archived', 'Commissioned'],
}
```

**Nayi `normalizeQuotationStatus()` function add hua:**
- `'Active / Generated'` → automatically `'Active / Sent'` ban jaata hai (backward compat)
- Koi bhi unknown status → `'Active / Sent'` fallback

**UUID Validation add hua — SQL injection se protection:**
```javascript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function toValidUuid(val) {
  return UUID_REGEX.test(val) ? val : null;
}
```

**`getBomCatalogMap()` — 400+ line nayi function:**
- Redis cache se BOM catalog fetch karta hai
- ID Aliases map banaya (spelling mistakes ka safety net):
  - `anchor_fastener` ↔ `anchor_fasner`
  - `la_patti` ↔ `l_angle`
  - `dc_wire_4sqmm` ↔ `dc_cable_red`
  - 30+ more aliases
- `transportation` aur `turnkey_installation` items hamesha guaranteed hain

---

### `api/_lib/adminHandlers.js` — Bilkul Nayi File (1,694 Lines)

Yeh file pehle exist nahi karti thi. Centralized admin operations handler:

- **`generateCollisionFreeDealerCode()`** — DB se latest code query karke next sequential code generate (e.g. `SV-DLR-1042`). Duplicate impossible.
- **Dealer CRUD** — Create, Read, Update, Delete sab server-side
- **Staff CRUD** — Same pattern
- **`bcrypt` hashing** — Server-side only, frontend pe nahi
- **Redis cache invalidation** — Data change hone par auto-flush

---

### `api/_lib/requireAuth.js` — Complete Rewrite

**Pehle:** Sirf admin JWT check karta tha.

**Ab:** Multi-role + live DB status check:

```javascript
export async function checkAccountActiveStatus(payload) {
  // 1. Redis cache check (60s TTL) — user:status:{role}:{id}
  // 2. Cache miss → Direct PostgreSQL query
  // 3. PG fail → Supabase REST fallback
  // 4. Dono fail + production → 503 fail closed
}
```

**Status → HTTP code mapping:**
- `suspended` → **403 Forbidden**
- `not_found` → **401 Unauthorized**
- DB down in production → **503 Service Unavailable**

**Critical security fix:** Pehle JWT ek baar ban jaane ke baad account suspend karne par bhi user access kar sakta tha. Ab har request pe DB se status check hota hai (cached 60s).

---

### `api/_lib/slackSync.js` — Nayi File (765 Lines)

Pura Slack integration system:
- Har customer file ke liye ek Slack thread maintain karta hai
- Status change, document upload pe Slack Block Kit messages
- Race condition guards (`lastSyncAt` timestamp check)
- In-place thread update, naya message nahi bhejta

---

### `functions/` Directory — Cloudflare Pages Port

Puri `api/` directory ko `functions/api/` mein copy kar diya gaya Cloudflare Pages ke liye. **Dual deployment:** Vercel + Cloudflare dono support.

---

## 🗄️ Database — Migrations & Schema

### Migration 000 — Column Alignment

```sql
-- quotations: Share token, payload, request dedup
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS quote_payload JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS request_id UUID UNIQUE,
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;

-- dealer_accounts: Staff assignment + pricing config
ADD COLUMN IF NOT EXISTS assigned_staff_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS max_margin_cap_per_kw NUMERIC(10,2) DEFAULT 6000.00,
ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'Gold EPC';

-- customer_files: More info fields
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Gujarat',
ADD COLUMN IF NOT EXISTS discom_application_no VARCHAR(100);

-- Quotation sequence — no more duplicate IDs
CREATE SEQUENCE IF NOT EXISTS public.quotation_seq START WITH 801;
```

### Migration 011 — RLS Lockdown V2 (Critical)

- **Sabhi tables pe RLS enable** (loop se automatic)
- **Legacy views drop** jo RLS bypass karte the (`dealers`, `admin_users`, `staff_users`, `audit_log`)
- **Sensitive tables Realtime se remove** (`dealer_accounts`, `staff_accounts`, `quotations`, etc.)
- **Universal `service_role` policies** har table pe

**Matlab:** Ab koi anon user Supabase Realtime ya REST se sensitive data nahi dekh sakta.

### Migrations 012-019

| Migration | Kya Kiya |
|-----------|---------|
| 012 | Governance settings defaults seed |
| 013 | Share tokens + performance indexes |
| 014 | Numeric price columns backfill |
| 015 | Privilege hardening, sequence search_path |
| 016 | Staging database schema parity |
| 017 | Missing tables seed |
| 018 | Customer files Slack thread column |
| 019 | Quotations columns widen |

---

## 🔒 Security — Kya Fix Hua

| Vulnerability | Pehle | Ab |
|---------------|-------|-----|
| Suspended account access | JWT valid rehta tha | DB status check (60s cache) |
| Anon Supabase queries | Possible | RLS lockdown, no anon policies |
| Password hashing location | Browser/client pe | Server-side only |
| Dealer code collision | Random, could repeat | DB-sequential generation |
| UUID SQL injection | No validation | Regex validate |
| Fake bank details in code | `SBIN0001234` hardcoded | Empty string defaults |

**`dealerService.js` security fix:**
```javascript
// PEHLE — Fake bank info hardcoded (security + data quality issue)
bankName: d.bank_name || 'State Bank of India',
accountNumber: d.account_number || '394857201948',
ifscCode: d.ifsc_code || 'SBIN0001234',

// AB — Real data only, DB se aayega
bankName: d.bank_name || '',
accountNumber: d.account_number || '',
ifscCode: d.ifsc_code || '',
```

---

## 📝 `CreateQuotation.jsx` — Sabse Bada Change (263 Lines)

### State Variables Ko Move Kiya — Logic Fix

**Pehle:** `panelBrand`, `panelWatt`, `panelQuantity`, `inverterCapacityKw` states component ke beech (line ~584-760) define thi — `useMemo` ke baad.

**Ab:** Sab states component ke shuru (line ~219) mein move ki gayi hain.

**Kyu important?** React mein hooks ka order consistent rehna chahiye. Pehle wali position potential React Hooks ordering violation thi. Ab bug-free.

**`inverterCapacityKw` initialization fix:**
```javascript
// PEHLE — 0 bhi valid maan leta tha, aur auto-match function call karta tha
if (!isNaN(parsed)) return parsed;  // 0 kW inverter! Bug.

// AB — Proper validation + safe default
if (!isNaN(parsed) && parsed > 0) return parsed;
return 3.6;  // Safe default
```

---

### Dealer-Specific Custom System Pricing — Nayi Feature

`activePresetBasePrice` useMemo mein nayi priority chain:

```
1st: Dealer-specific brand+kW rate (e.g., "dealer X ke liye 5kW Adani = ₹2,10,000")
2nd: Dealer-specific flat kW rate
3rd: Standard DB matrix panelPrices
4th: Legacy snake_case field fallback
```

**Dependency array mein `selectedPresetKw` aur `effectiveDealer` add hue** — price auto-update hogi.

---

### Margin Quick-Select Buttons — Dynamic Ho Gaye

**Visual change — Pehle (hardcoded buttons):**
```
[ ₹3,500/kW ] [ ₹4,500/kW ] [ ₹5,500/kW ] [ ₹6,500/kW ] [ ₹8,000/kW ]
```

**Ab (database se):**
```javascript
// DB mein jo tier margins hain wahi dikhenge
[tierMargins.silver, tierMargins.gold, tierMargins.platinum, tierMargins.diamond, dealerCap]
  .filter(r => r > 0)
  .filter((v,i,a) => a.indexOf(v) === i)  // No duplicates
  .sort((a,b) => a-b)
```

Agar admin ne tiers configure kiye hain toh wahi buttons dikhengi. No more hardcoded values.

---

### Default Margin Fix — Important

```javascript
// PEHLE — DB mein tier nahi hai toh bhi ₹4,500 automatically lagta tha!
tierMargins?.[dealerTierKey] || { defaultMarginPerKw: 4500, maxMarginCapPerKw: 6000 }

// AB — Zero se shuru, admin explicitly set kare
tierMargins?.[dealerTierKey] || { defaultMarginPerKw: 0, maxMarginCapPerKw: 0 }
```

Yahi zero-default change `effectiveMarginPerKw` aur `marginRatePerKw` mein bhi apply hua.

---

### Quotation Status Rename

```javascript
// PEHLE
'Active / Generated'
// AB
'Active / Sent'
```

Zyada correct business terminology.

---

### `savedResult` Pattern — DB Return Value Fix

```javascript
// PEHLE — DB ka actual return value ignore hota tha
await addQuotation(quotePayload);
setPreviewQuotation(quotePayload);  // Client-side payload, server ID nahi jaanta

// AB — DB se real saved record
const savedResult = await addQuotation(quotePayload);
const finalQuote = savedResult || quotePayload;
setPreviewQuotation(finalQuote);  // Server-assigned ID milti hai
```

Fix: Preview mein galat quotation ID dikhti thi.

---

### Pricing Unavailable Error Screen — Nayi Visual

**Naya UI state add hua — Jab pricing DB se load na ho:**

```
┌──────────────────────────────────────┐
│   ☁️  [amber cloud_off icon]         │
│                                      │
│  Pricing data temporarily            │
│  unavailable. Please retry.          │
│                                      │
│  Network error description...        │
│                                      │
│  [ 🔄 Retry Loading Pricing ]       │
└──────────────────────────────────────┘
```

**Condition:** `isHardwareDbSyncing=false` AND `pricingPresets=null` AND `modulesList` empty.

Pehle yeh condition mein blank screen ya crash hota tha.

---

### Inverter Selection Modal — UI + Logic Fix

**Visual changes:**
- `max-h-[60vh] overflow-y-auto` add hua — ab scroll kiya ja sakta hai
- Name ke saath capacity: `"Growatt (5 kW)"`
- Phase info: `"Grid-Tied • MNRE Approved"`
- Default efficiency: `'98.5%'` agar DB mein nahi hai

**Logic changes:**
```javascript
// PEHLE — Sirf model name set hota tha
setInverterModel(inv.name);

// AB — Brand, capacity, price sab set hoti hai
setInverterBrand(inv.brand || inv.name);
setInverterCapacityKw(Number(inv.capacityKW || inv.capacity_kw));
setInverterUnitPrice(Number(inv.basePrice || inv.price));
setUserOverrodeInverter(true);
```

**Data source fix:** `availableInverters` → `activeInverters || invertersList` (broader list)

**Selection highlight fix:** `inverterModel === inv.name` → `inverterBrand === (inv.brand || inv.name)`

---

## 📄 `PDFTemplate.jsx` — Visual + Logic

### Billing Profile Guard — Nayi Blocking Screen

**Sabse important visual change in this PR:**

```
┌──────────────────────────────────────────────┐
│  🔴 [error_outline icon - red circle]        │
│                                              │
│  Quotation PDF Generation Blocked            │
│                                              │
│  Company GSTIN and Bank Account details      │
│  are required before generating...           │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ GSTIN: MISSING (Empty)                 │  │
│  │ Bank Account: MISSING (Empty)          │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Please navigate to Admin Settings >         │
│  Company Profile to configure billing.       │
└──────────────────────────────────────────────┘
```

Background: `bg-red-950/20` | Border: `border-red-500/50`

```javascript
const hasGstin = Boolean(companyProfile?.gstin && String(companyProfile.gstin).trim());
const hasBank = Boolean(bankAcc && String(bankAcc).trim());
if (!hasGstin || !hasBank) return <BlockingMessage />;
```

Pehle incomplete PDF generate ho jaati thi. Ab hard block hai.

---

### Dynamic Company Info in PDF

```jsx
// PEHLE — Sab hardcoded
<h3>THANK YOU FOR CHOOSING SUNVINE RENEWABLE</h3>
<p>G-705, Second Gate, Metoda GIDC, Rajkot - 360021 (Guj.)</p>
<div>+91 95865 33750 • sunvinerenewable@gmail.com</div>

// AB — Admin settings se dynamic
<h3>THANK YOU FOR CHOOSING {companyProfile.name || 'SUNVINE RENEWABLE'}</h3>
<p>{companyProfile.address || 'Gujarat, India'}</p>
<div>{companyProfile.whatsapp} • {companyProfile.email}</div>
<li>{companyProfile.validityText || 'Valid for 15 days...'}</li>
```

---

### Energy Calculation Fix

```javascript
// PEHLE — Hardcoded yield aur tariff
const annualGenUnits = quotation.annualGenerationUnits || Math.round(resolvedCapKW * 1440);
const annualSavings = quotation.annualSavings || Math.round(annualGenUnits * 6.67);

// AB — System settings se dynamic
const specificYield = Number(
  quotation.specificYield || systemSettings?.governance_settings?.default_specific_yield
) || DEFAULT_SPECIFIC_YIELD;

const tariff = Number(
  quotation.tariff || systemSettings?.governance_settings?.default_tariff
) || DEFAULT_TARIFF_PER_UNIT;

// Payback '0' aur '0.0' values ignore hoti hain (DB bug fix)
const paybackYears = (quotation.paybackYears && quotation.paybackYears !== '0.0')
  ? String(quotation.paybackYears)
  : (netPayable / annualSavings).toFixed(1);
```

---

### Installation Cost Fix

```javascript
// PEHLE — Always per-kW rate
Math.round(resolvedCapKW * 2000)

// AB — Fixed amount bhi support
quotation.installationPricingMode === 'fixed'
  ? Number(quotation.installationFixedAmount || 0)
  : Math.round(resolvedCapKW * Number(quotation.installationRatePerKw || 2000))
```

---

## 👁️ `QuotationPreview.jsx` — Preview Flow Fix

### URL + SessionStorage Sync — Nayi Feature

```javascript
const getUrlOrStoredQuoteId = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return (
    urlParams.get('id') ||
    urlParams.get('quoteId') ||
    urlParams.get('quotationId') ||
    sessionStorage.getItem('sunvine_preview_quote_id') ||
    localStorage.getItem('sunvine_preview_quote_id') ||
    null
  );
};
```

Ab `?id=QT-1234` URL se direct preview khul sakta hai. Hard refresh ke baad bhi quotation dikh sakti hai.

---

### Public Share Token Flow Fix

```javascript
// PEHLE — ID se fetch karta tha (wrong for token-based links)
quotationService.getQuotationById(publicQuoteId)

// AB — Token se public proposal
if (token) {
  quotationService.getPublicProposal(token).then(...)
}
```

---

### Active Quotation Resolution — Simpler Logic

```javascript
// PEHLE — Complex nested conditions
const activeQuotation = useMemo(() => {
  if (propQuotation) return propQuotation;
  if (isPublicView) {
    if (remoteFetchedQuote) return remoteFetchedQuote;
    if (publicQuoteId) { /* complex */ }
    return previewQuotation || null;
  }
  return previewQuotation;
});

// AB — Clear linear priority
const activeQuotation = useMemo(() => {
  if (propQuotation) return propQuotation;       // 1st priority
  if (remoteFetchedQuote) return remoteFetchedQuote; // 2nd
  if (previewQuotation) return previewQuotation; // 3rd
  // URL/storage se ID → quotations list mein search
  // Portal fallback: newest quotation
  return null;
});
```

**Plus:** Company profile quotation ke saath inject hoti hai:
```javascript
const quotationWithProfile = useMemo(() => ({
  ...activeQuotation,
  companyProfile: activeQuotation.companyProfile || companyProfile
}), [activeQuotation, companyProfile]);
```

---

## 📊 `AllQuotations.jsx` — Admin View Upgrade

### Applications Tab — Bilkul Nayi Feature

**Admin panel mein nayi tab add hui:**

```
┌──────────────────────────────────────────────────┐
│ [ Quotations ] [ All Applications ]  ← Nayi tab │
│                                                  │
│ Filters: Channel (Dealer/Staff) | Dealer Name   │
│          DISCOM | Stage | View Mode Toggle       │
│                                                  │
│ Table view / Cards view toggle available         │
└──────────────────────────────────────────────────┘
```

`allUniversalFiles` synthesis logic:
- Real `customerFiles` + quotations jo abhi files nahi bane → merge karta hai
- `sourceType` auto-detect: `DEALER` ya `STAFF`
- Synthesized file object mein timeline bhi inject hoti hai

---

### Margin Compliance Logic Fix

```javascript
// PEHLE — Fixed ₹5,500 cap hardcoded
const isFlagged = marg > 5500;

// AB — Dealer ka actual cap use
const dealerCap = getDealerCapForQuote(q);
const isFlagged = Boolean(q.isFlagged || q.requiresAudit || (dealerCap > 0 && marg > dealerCap));
```

Compliant status bhi fix:
```javascript
// PEHLE — avg > 5000 hone par 'review' dikhata tha
const status = flaggedCount > 0 ? 'flagged' : avg > 5000 ? 'review' : 'compliant';

// AB — Binary: flagged ya compliant
const status = flaggedCount > 0 ? 'flagged' : 'compliant';
```

---

### CSV Export Fix

```javascript
// PEHLE — Hardcoded fake values in CSV
escapeCsv(q.dealerMarginPerKW || 4500),
escapeCsv(q.subsidyAmount || (q.systemCapacityKW <= 2 ? 60000 : 78000)),

// AB — Real calculated values
escapeCsv(q.dealerMarginPerKW || (q.dealerTotalMargin && q.systemCapacityKW
  ? Math.round(q.dealerTotalMargin / q.systemCapacityKW) : 0)),
escapeCsv(getStoredSubsidy(q)),  // Dynamic subsidy
```

---

## 🏢 `DealerManagement.jsx` — Dealer Tab Revamp

### Safe Destructuring with Defaults

```javascript
// PEHLE — Crash if AppContext undefined
const { dealers, addDealer, updateDealer } = useApp();

// AB — Safe defaults
const {
  dealers = [],
  isHardwareDbSyncing = false,
  addDealer = () => {},
  updateDealer = () => {},
  ...
} = useApp() || {};
```

---

### Skeleton Loaders — Nayi Visual

```javascript
import { DealerTableSkeletonRows, DealerCardGridSkeleton } from './DealerSkeletons';
```

**Pehle:** Dealer list load hoti thi toh blank screen.
**Ab:** Animated gray skeleton rows/cards dikhte hain — premium feel.

---

### Delete Flow Fix — Race Condition Hataya

```javascript
// PEHLE — State clear baad mein hoti thi
deleteDealer(dealerToDelete.id);
setDealerToDelete(null);  // Race condition!

// AB — State pehle clear, phir async delete
const targetDealer = dealerToDelete;
setDealerToDelete(null);         // Pehle clear
await deleteDealer(targetId);   // Phir delete
```

---

### Pricing Modal — Dynamic Defaults

```javascript
// PEHLE — Hardcoded
const [customWpRate] = useState(18.00);
const [customKwRate] = useState(58000);

// AB — pricingPresets DB se
const baseKw = pricingPresets?.baseRatePerKw || 58000;
const baseWp = baseKw > 0 ? Number((baseKw / 1000).toFixed(2)) : 18.00;
```

Tier margin bhi dynamic:
```javascript
const dynMargin = tierMargins?.[tierKey]?.defaultMarginPerKw ?? 0;
```

---

## ⚙️ `AdminSettings.jsx` — New Fields Added

### GSTIN, PAN, Address — Nayi UI Fields

**Dealer add/edit form mein 3 naye input fields:**

```
GSTIN Number (Optional)    PAN Number (Optional)
[24AAECB1234F1Z5    ]     [AAECB1234F       ]

Address
[Dealer firm ka full address input...]
```

**Smart GSTIN → PAN auto-extract:**
```javascript
onChange={(e) => {
  const val = e.target.value.toUpperCase();
  setDealerForm(prev => ({
    ...prev,
    gstin: val,
    pan: val.length >= 12 ? val.slice(2, 12) : prev.pan
  }));
}}
```

GSTIN type karte waqt PAN automatically fill ho jaata hai.

**`maxMarginCapPerKw` default fix:**
```javascript
// PEHLE: 6000 hardcoded
// AB: tierMargins?.gold?.maxMarginCapPerKw || 0
```

**Dealers/Staff AppContext sync:**
```javascript
// Ab settings page khulte hi data populate hoti hai
const [dealersList] = useState(() => (dealers?.length > 0 ? dealers : []));
useEffect(() => {
  if (dealers?.length > 0 && dealersList.length === 0) setDealersList(dealers);
}, [dealers]);
```

---

## 🌐 `AppContext.jsx` — Core State Changes

### `safeSetItem` / `safeJsonParse` — Module Level Move

Pehle yeh functions `AppProvider` component ke middle mein define the. Ab module level par hain — cleaner aur hoisting-safe.

**Behavior change:** `safeSetItem` ab sirf localStorage mein write karta hai. (Session isolation issue — neeche dekho)

---

### Initial State — Null Defaults

```javascript
// PEHLE — Default values se initialize
const [pricingMaster] = useState(DEFAULT_PRICING_MASTER);
const [pricingPresets] = useState(() => cacheManager.get('pricing_presets', DEFAULT_PRICING_MASTER.quotationPresets));
const [tierMargins] = useState(() => cacheManager.get('tier_margins', DEFAULT_PRICING_MASTER.tierMargins));

// AB — null se shuru, DB load hone par update
const [pricingMaster] = useState(null);
const [pricingPresets] = useState(() => cacheManager.get('pricing_presets', null));
const [tierMargins] = useState(() => cacheManager.get('tier_margins', null));
```

Ab app clearly distinguish kar sakta hai "loading" vs "zero value".

---

### `previewQuotation` — Callback Setter with Storage Sync

```javascript
const setPreviewQuotation = useCallback((quoteOrFn) => {
  setPreviewQuotationState(prev => {
    const next = typeof quoteOrFn === 'function' ? quoteOrFn(prev) : quoteOrFn;
    if (next?.id) {
      sessionStorage.setItem('sunvine_preview_quote_id', next.id);
      localStorage.setItem('sunvine_preview_quote_id', next.id);
    }
    return next;
  });
}, []);
```

Quotation set hone par automatically storage sync hoti hai — hard refresh fix ka base.

---

### `currentStaff` Default Fix

```javascript
// PEHLE — Fake DEFAULT_STAFF[0] object use karta tha
safeJsonParse('sunvine_current_staff', DEFAULT_STAFF[0]) || DEFAULT_STAFF[0]

// AB — null default, real data DB se aayega
safeJsonParse('sunvine_current_staff', null) || null
```

---

### Tier Margin Calculation — Dynamic

```javascript
// PEHLE — Hardcoded tier defaults
const defaultTierMargin = tierLower.includes('diamond') ? 6500 :
                          tierLower.includes('platinum') ? 5500 :
                          tierLower.includes('silver') ? 3500 : 4500;

// AB — DB se
const tierKey = tierLower.includes('diamond') ? 'diamond' : ...;
const dynamicDefaultMargin = tierMargins?.[tierKey]?.defaultMarginPerKw ?? 0;
```

---

## 🔗 `DealerService.js` — API-First

### `getAllDealers()` — Dual Fetch

```
Priority 1: POST /api/auth/admin-dealers (op: 'list')
  ↓ (fail)
Priority 2: Direct Supabase read-only
```

Response normalization add hua — snake_case DB fields → camelCase frontend fields.

### `createDealer()` — Server-Side Only

```
Priority 1: POST /api/auth/admin-dealers (op: 'create')
  ↓ (fail)
Priority 2: POST /api/auth/manage-credentials
❌ Client-side bcrypt fallback — REMOVED (security fix)
```

---

## 📋 `QuotationService.js` — Normalized

### `normalizeQuotationRow()` — Extended

Nayi fields ab hamesha normalize hoti hain:
- `subsidyAmount`, `netPayable`
- `annualGenerationUnits`, `monthlyGenerationUnits`, `annualSavings`, `monthlySavings`
- `paybackYears`, `tariff`, `specificYield`
- `shareToken`, `shareExpiresAt`
- `companyProfile`, `bomItems`, `bomTotals`

### `getLocalQuotationById()` — Nayi Method

LocalStorage scan karta hai: quotations ledger + draft/preview cache keys.

### Direct Supabase Fallback Remove

```javascript
// PEHLE — API fail hone par Supabase try karta tha
catch { /* direct Supabase query */ }

// AB — Clean error return
catch (err) {
  console.error('[quotationService]', err);
  return [];
}
```

---

## 💰 `PricingService.js` — Zero Hardcoding

```javascript
// PEHLE — Fallback prices hardcoded
baseRatePerKw: Number(data.base_rate_per_kw) || 59800,
subsidyCap: Number(data.subsidy_cap) || 78000,
minMarginPerKw: Number(data.min_margin_per_kw) || 4000,

// AB — Zero defaults
baseRatePerKw: Number(data.base_rate_per_kw) || 0,
subsidyCap: Number(data.subsidy_cap) || 0,
minMarginPerKw: Number(data.min_margin_per_kw) || 0,
```

BOS Matrix fetch mein bhi `/api/catalog?type=bos` first try hota hai.

---

## 📁 `MyApplications.jsx` — File Upload Fix

### Realtime Subscription Add Hua

```javascript
useRealtimeCustomerFiles({
  role: 'dealer',
  dealerId: currentDealer?.id,
  onRefresh: refreshCustomerFiles
});
```

Dealer ko ab manually refresh nahi karna — UI auto-update.

### Escape Key Handler — UX Fix

```javascript
// Pehle modals Escape se band nahi hote the
// Ab sab modals Escape se close hote hain (priority order mein)
```

### Multi-File Upload Index Fix

```javascript
// PEHLE — Files overwrite ho jaati thin
uploadCustomerDocument(file, id, docKey)

// AB — Index track karta hai
const currentFileIndex = existingCount + uploadedDocsList.length + 1;
uploadCustomerDocument(file, id, docKey, { fileIndex: currentFileIndex })
```

### File ID Fix

```javascript
// PEHLE — Sequential (predictable, conflict possible)
`FIL-2026-${(customerFiles.length + 85).padStart(3, '0')}`

// AB — Random 5-char alphanumeric
const randPart = Math.random().toString(36).substring(2, 7).toUpperCase();
`FIL-${year}-${randPart}`  // e.g., FIL-2026-X7K2P
```

---

## 👷 `StaffNewLead.jsx` — Lead Create Fix

### Base Rate Dynamic

```javascript
// PEHLE — Hardcoded ₹58,000/kW
Math.round(kw * 58000)

// AB — DB se live rate
const baseRate = pricingPresets?.baseRatePerKw || 0;
Math.round(kw * baseRate)
```

### Async Submit + Loader

```javascript
// PEHLE — Synchronous, no error handling
addCustomerFile(newFile);

// AB — Async with full error handling
const handleSubmit = async (e) => {
  try {
    showLoader('Creating customer lead...');
    const res = await addCustomerFile(newFile);
    const savedFile = res || newFile;
    addToast(`Lead "${savedFile.customerName}" created!`, 'success');
    setActiveTab('staff_files');
  } catch (err) {
    addToast(err.message || 'Failed', 'error');
  } finally {
    hideLoader();
  }
};
```

---

## 📦 New Files Jo Add Hue

| File | Lines | Kya Hai |
|------|-------|---------|
| `api/_lib/adminHandlers.js` | 1,694 | Admin CRUD engine |
| `api/_lib/security.js` | 21 | Password hashing + validation |
| `api/_lib/slackSync.js` | 765 | Slack thread sync |
| `functions/` directory | ~9,000+ | Cloudflare Pages port |
| `DealerAccountsManagement.jsx` | 947 | Full dealer accounts tab |
| `StaffAccountsManagement.jsx` | 966 | Full staff accounts tab |
| `DealerSkeletons.jsx` | 404 | Loading skeleton UI |
| `DealerPageParts.jsx` | 208 | Reusable dealer table parts |
| `AnimatedNumber.jsx` | 60 | Animated counter component |
| `Skeleton.jsx` | 325 | Generic skeleton loaders |
| `ui/skeleton.jsx` | 173 | Base skeleton primitives |
| `useRealtimeCustomerFiles.js` | 49 | Supabase realtime hook |
| `documentStorageConfig.js` | 114 | Storage path config |
| `standardBomData.js` | 28 | BOM catalog defaults |
| 13 `__tests__/*.test.js` | ~3,800 | Regression test suite |
| 9 Supabase migrations | ~1,200 | DB schema updates |
| Multiple rollout scripts | ~2,000+ | Deployment & DB tools |

---

## 🗑️ Deleted Files

| File | Kyu Delete Kiya |
|------|----------------|
| `AUDIT_REPORT.md` | Replaced by newer docs |
| `AUDIT_REPORT_V2.md` | Same |
| `GIT_COMMITS_REPORT.md` | Outdated |
| `HANDOVER_SR66_EMPTY_STATE_ISSUE.md` | Resolved |
| `HARDWARE_AUDIT_REPORT.md` | Outdated |
| `LADDER_DEPLOYMENT_WORKFLOW.md` | Replaced |
| `PRICING_AND_DB_AUDIT_REPORT.md` | Outdated |
| `REDIS_OPTIMIZATION_PLAN.md` | Implemented |
| `RESPONSIVE_UI_RULES.md` | Moved to rules/skills |
| `Sunvine_Merged_Audit_Report.md` | Replaced |
| `docs/ROLLOUT.md` | Replaced by OPERATIONS guide |

---

## ⚠️ Potential Issues & Bugs

### 🔴 CRITICAL — Fix Immediately

#### Issue 1: Admin Role — Client-Side Trust

**File:** [`quotationService.js`](file:///e:/repos/dealer-portal-quotation/src/services/quotationService.js)

```javascript
// Role check sessionStorage se ho rahi hai — spoof possible!
const currentRole = sessionStorage.getItem('sunvine_session_role');

if (currentRole === 'admin') {
  const { data: dbData } = await supabase
    .from('quotations')
    .select('*')  // No RLS filter!
```

**Problem:** Koi bhi browser console mein jaake `sessionStorage.setItem('sunvine_session_role', 'admin')` kare, toh direct Supabase bypass ho sakta hai.

**Fix:** Backend API se role verify karo, frontend storage pe trust mat kar🎯

---

#### Issue 2: Tab Isolation Broken

**File:** [`AppContext.jsx`](file:///e:/repos/dealer-portal-quotation/src/context/AppContext.jsx)

```javascript
const safeSetItem = (key, value) => {
  localStorage.setItem(key, ...);  // sessionStorage write NAHI hoti ab
};
```

**Problem:** Pehle `SESSION_KEYS` sessionStorage mein bhi save hote the (tab isolation). Ab sirf localStorage. Ek tab mein admin login, doosre mein dealer — dono ek hi credentials share karenge.

**Fix:** SESSION_KEYS ke liye sessionStorage.setItem vapas laa🎯

---

### 🟡 MEDIUM — Soon Fix Karo

#### Issue 3: Inverter Default 3.6 kW — Dumb Default

**File:** [`CreateQuotation.jsx`](file:///e:/repos/dealer-portal-quotation/src/components/DealerPortal/CreateQuotation.jsx)

```javascript
// PEHLE — System size se auto-match karta tha
const initialMatched = getAutoInverterMatch(kw, inverterBrand);
return initialMatched.capacityKW;

// AB — Fixed 3.6 kW default always
return 3.6;
```

10 kW system ke liye 3.6 kW inverter suggest hoga — galat. User ko manually change karna padega.

---

#### Issue 4: Margin Buttons Empty Ho Sakte Hain

**File:** [`CreateQuotation.jsx`](file:///e:/repos/dealer-portal-quotation/src/components/DealerPortal/CreateQuotation.jsx)

```javascript
// Agar tierMargins exist karta hai lekin values 0 ya undefined hain
.filter((r) => typeof r === 'number' && r > 0)  // Sab filter ho jaayenge!
```

Result: Koi margin button nahi dikhega. User margin set nahi kar payega.

---

#### Issue 5: PDF Billing Guard — Bank Key Mismatch

**File:** [`PDFTemplate.jsx`](file:///e:/repos/dealer-portal-quotation/src/components/DealerPortal/PDFTemplate.jsx)

```javascript
const bankAcc =
  companyProfile?.bank?.accountNumber ||
  companyProfile?.bank?.account_number ||
  companyProfile?.bankDetails?.accountNumber ||
  companyProfile?.bankDetails?.account_number;
  // ⚠️ bankDetails?.accountNo — nahi check hua!
```

Agar DB mein `accountNo` key use ho rahi hai toh PDF block hogi even if data hai.

---

#### Issue 6: `allUniversalFiles` — Naam Se Match

**File:** [`AllQuotations.jsx`](file:///e:/repos/dealer-portal-quotation/src/components/AdminPortal/AllQuotations.jsx)

```javascript
f.customerName.toLowerCase() === q.customerName.toLowerCase()
// ⚠️ Ek hi naam ke do customers ho sakte hain!
```

Duplicate names hone par wrong file ko quotation se link kar dega.

---

### 🟢 LOW — Jab Time Mile

#### Issue 7: `currentUser` Dead State

```javascript
const [currentUser, setCurrentUser] = useState(null);
// Defined but never used — dead code
```

---

## ✅ Final Verdict

### Kya Achha Hua

| Area | Rating | Detail |
|------|--------|--------|
| Security Hardening | ⭐⭐⭐⭐⭐ | RLS lockdown, server hashing, UUID validate |
| Zero Hardcoding | ⭐⭐⭐⭐⭐ | Pricing, margins, company info — sab DB-driven |
| DB Schema | ⭐⭐⭐⭐⭐ | 9 migrations, sequences, proper types |
| API Architecture | ⭐⭐⭐⭐ | Consistent API-first pattern |
| Error Handling | ⭐⭐⭐⭐ | Try-catch everywhere, loaders |
| Visual UX | ⭐⭐⭐⭐ | Skeletons, error screens, Escape key |
| PDF Generation | ⭐⭐⭐⭐ | Dynamic company, billing guard |
| Test Coverage | ⭐⭐⭐⭐ | 13 new comprehensive test files |

### Summary Table of Issues

| Priority | Issue | File | Action |
|----------|-------|------|--------|
| 🔴 Critical | Admin role client-side trust | `quotationService.js` | Server-side verify |
| 🔴 Critical | Tab isolation broken | `AppContext.jsx` | SessionStorage vapas laao |
| 🟡 Medium | Inverter 3.6 kW fixed default | `CreateQuotation.jsx` | Auto-match vapas |
| 🟡 Medium | Margin buttons empty | `CreateQuotation.jsx` | Fallback add karo |
| 🟡 Medium | PDF bank key mismatch | `PDFTemplate.jsx` | Normalize keys |
| 🟡 Medium | Name-based file match | `AllQuotations.jsx` | ID-based match use |
| 🟢 Low | `currentUser` dead state | `AppContext.jsx` | Remove ya use karo |

---

> **Overall:** Yeh PR ek major architectural upgrade hai — "direct Supabase everywhere" se "secure API gateway first" pattern ki taraf move. Pricing ki puri hardcoding hatayi gayi. Security bahut better hua. **2 critical issues hain** jo production mein immediately fix hone chahiye (tab isolation + client-side role trust). Baki sab changes solid aur well-thought-out hain.

---

*Report: 12 October 2026, 09:07 IST | PR #5 → sumit-updates | 196 files | +31,882 / -8,199 lines*


---

## ?? Commit `fd90f0cb` � Architecture Refactor (by Shubhhh)

> **Author:** Shubhhh | **Date:** Mon Oct 12 2026, 09:16 IST
> **29 files changed, 1,818 insertions, 15 deletions**
> **Commit Message:** `refactor: modularize architecture, decouple business logic, add UI design system, centralized env config, and complete documentation`

Yeh commit sabse latest hai aur ek pure architectural refactor ka kaam karta hai. Koi business logic nahi badli � sirf code ko better organize kiya gaya.

---

### 3a. Centralized Client Env Config � `src/config/env.js` (Nayi File)

**Pehle:** Har file apna `import.meta.env.VITE_*` check karti thi � duplicated logic everywhere.

**Ab:** Ek single frozen config object:

`js
export const ENV = Object.freeze({
  SUPABASE_URL:      getEnvVar('VITE_SUPABASE_URL', 'https://placeholder.supabase.co'),
  SUPABASE_ANON_KEY: getEnvVar('VITE_SUPABASE_ANON_KEY', 'placeholder-anon-key'),
  GEOAPIFY_API_KEY:  getEnvVar('VITE_GEOAPIFY_API_KEY', ''),
  APP_ENV:           getEnvVar('MODE', 'development'),
  IS_PRODUCTION:     ...,
  IS_TEST:           ...,
  BASE_URL:          ...
});
`

`getEnvVar()` helper dono `import.meta.env` aur `process.env` try karta hai � Vite aur Node dono mein kaam karta hai.

---

### 3b. Server-Side Env Config � `api/_lib/env.js` (Nayi File)

Backend ke liye separate config with getter-based lazy evaluation:
- `SERVER_ENV.supabaseUrl`, `SERVER_ENV.jwtSecret`, `SERVER_ENV.redisRestUrl`, `SERVER_ENV.r2BucketName`, `SERVER_ENV.slackBotToken`, `SERVER_ENV.isProduction`
- `validateServerEnv()` � Startup pe warn karta hai agar critical vars missing hain

---

### 3c. `src/lib/supabase.js` � Simplified

`js
// PEHLE � Inline duplicated env detection
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL);

// AB � Clean import from centralized config
import { ENV } from '../config/env.js';
const supabaseUrl     = ENV.SUPABASE_URL;
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY;
`

---

### 3d. API Response Helpers � `api/_lib/apiResponse.js` (Nayi File)

Standard response format sabhi endpoints ke liye:

`js
jsonSuccess(res, data, meta, statusCode = 200)
// ? { success: true, data, meta?, timestamp }

jsonError(res, statusCode, message, details, code = 'API_ERROR')
// ? { success: false, error, code, details?, timestamp }

parseRequestBody(req)
// ? Supports pre-parsed req.body OR raw stream
`

---

### 3e. API Error Handler � `api/_lib/errorHandler.js` (Nayi File)

**`sanitizeError()`** � Sensitive info client tak nahi pahunchi:
- `password`, `jwt`, `postgresql://`, `connection refused` detect karta hai ? generic message bhejta hai
- Production mein stack trace nahi jaata client tak

**`withApiHandler(handler, options)`** � HOC wrapper:
- CORS apply
- OPTIONS preflight handle
- Rate limit check
- try-catch with sanitized error response

---

### 3f. Client-Side Error Handler � `src/utils/errorHandler.js` (Nayi File)

`js
formatErrorMessage(error, fallback)
// Network errors ? friendly message

handleApiError(error, { showToast, report, context })
// Centralized toast + crash report

safeAsync(task, fallback = null)
// Returns [result, error] tuple � no unhandled rejections
`

---

### 3g. India Input Validators � `src/utils/validators.js` (Nayi File)

| Function | Validates |
|----------|-----------|
| `validatePhone(phone)` | Indian 10-digit number (+91/0 prefix) |
| `normalizePhone(phone)` | Always returns 10 digits |
| `validateGSTIN(gstin)` | 15-char Indian GST format |
| `validatePAN(pan)` | 10-char AAAAA9999A format |
| `validateIFSC(ifsc)` | 11-char AAAA0XXXXXX format |
| `validatePinCode(pin)` | 6-digit Indian PIN code |
| `validateEmail(email)` | Standard RFC email |

---

### 3h. Custom Hooks � `src/hooks/`

| Hook | Exposes |
|------|---------|
| `useAuth()` | `role`, `isAdmin/isDealer/isStaff`, `loginAs*`, `logout` |
| `useQuotations()` | `quotations`, `addQuotation`, `updateQuotation`, `previewQuotation` |
| `useCatalog()` | `modules`, `inverters`, `pricingPresets`, `tierMargins`, `bomCatalog` |
| `useCustomerFiles()` | `files`, `addFile`, `updateFile` |

**Kyu important:** Pehle har component 20+ values destructure karta tha `useApp()` se. Ab `useCatalog()` ya `useAuth()` call karo � sirf relevant state milegi.

---

### 3i. UI Design System � `src/components/ui/`

**`Button.jsx`** � WCAG compliant:
- Variants: `primary` (emerald-teal gradient), `secondary`, `outline`, `ghost`, `danger` (rose gradient), `subtle`
- Sizes: sm (36px), md (44px touch target), lg (48px)
- Built-in: loading spinner, icon left/right, `active:scale-[0.98]` micro-animation

**`Badge.jsx`** � Status badges:
- Variants: emerald, teal, amber, rose, sky, purple, slate
- All use `bg-*/15` opacity � dark theme friendly

**`Modal.jsx`** � Accessible dialog:
- Escape key dismiss, click-outside dismiss
- Body scroll lock, backdrop blur animation
- Optional title, subtitle, footer slots

**`Card.jsx`, `Input.jsx`, `Select.jsx`, `EmptyState.jsx`, `ErrorState.jsx`** � Standard enterprise UI, consistent across all portals.

**`src/components/ui/index.js`** � Barrel export for all components.

---

### 3j. Documentation Added

| File | Lines | Content |
|------|-------|---------|
| `README.md` | +100 | Setup instructions, architecture overview |
| `docs/ARCHITECTURE.md` | 141 | System diagram, data flow, layer descriptions |
| `docs/API_REFERENCE.md` | 83 | Endpoint documentation |
| `docs/DESIGN_SYSTEM.md` | 134 | Color tokens, typography, component usage |
| `docs/ENVIRONMENT_CONFIG.md` | 58 | All env vars reference |

---

*End of commit `fd90f0cb` section*

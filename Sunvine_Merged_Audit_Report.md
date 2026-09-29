# Sunvine Dealer Portal — Merged Independent + Antigravity Audit

**Audit date:** 29 September 2026  
**Repository:** `suryachauhan6985-pixel/dealer-portal-quotation`  
**Target version reported by Antigravity:** 2.2.1  
**Audit sources:**  
1. Antigravity/Gemini full-system audit  
2. Independent senior source-level audit

---

## 1. Scope

### Explicitly excluded

The login/authentication system is intentionally unfinished because the application is currently being tested.

Therefore these are **NOT counted as current bugs**:

- incomplete login UI
- mock authentication
- localStorage role switching
- demo credentials used only for development
- missing production authentication architecture
- password/OTP implementation that is intentionally temporary for testing

### Still in scope

Security of already-existing:

- Supabase tables/RLS
- public APIs
- data exposure
- destructive operations
- external API handling
- quotation persistence
- lead data
- client-side secrets/API keys
- production deployment behavior

---

# 2. Executive Summary

The two audits overlap on several important problems, but they also contain conflicting conclusions.

After merging them, the most important current issues are:

| Priority | Area | Finding |
|---|---|---|
| P0 | Database Security | Public `FOR ALL USING(true)` RLS policies allow unrestricted access to sensitive business tables |
| P1 | Quotation | `setSystemCapacity` can crash quotation-form reset if confirmed in current branch |
| P1 | Quotation | Shared proposal links depend on local browser state and are not portable |
| P1 | Quotation | Quotation IDs have only 900 possible values and can collide |
| P1 | Data Integrity | Save failures can still produce a success message |
| P1 | Data Integrity | Synthetic/fabricated lead data is presented as real/verified data |
| P1 | Persistence | Quotations are saved remotely but are not consistently hydrated from Supabase |
| P1 | Testing | Core solar calculation logic lacks a proper automated unit-test suite |
| P2 | Security | Client-side API keys stored in localStorage |
| P2 | Security | Public serverless endpoints lack strong abuse/rate-limit controls |
| P2 | Performance | Production JS entry bundle is approximately 4.64 MB raw / 906 KB gzip |
| P2 | Performance | Large Gujarat GIS data is bundled into the application |
| P2 | Performance | ~4 MB Material Symbols font is unnecessarily expensive |
| P2 | Architecture | `AppContext.jsx` is approximately 1,500+ lines and handles too many domains |
| P2 | Mobile | 3D rooftop canvas can capture touch gestures intended for page scrolling |
| P2 | Accessibility | Modal focus trapping/ARIA behavior needs improvement |
| P2 | UX | PDF/OCR operations lack sufficiently clear progress feedback |
| P2 | DevOps | CI exists, but the branch trigger appears to use the typo `devlopment` |
| P3 | Accessibility | Some small filter/icon controls are below recommended touch target size |
| P3 | Quality | Test/hardening scripts contain stale version references |

---

# 3. Critical Security Findings

## SEC-001 — Unrestricted Supabase RLS policies

**Severity: P0**

**Location:** `supabase_schema.sql`

The schema contains policies equivalent to:

```sql
FOR ALL
USING (true)
WITH CHECK (true)
```

for sensitive tables including:

- `quotations`
- `otp_verifications`
- `solar_modules`
- `solar_inverters`

There is also a public `SELECT` policy on `admin_users`.

### Impact

A client using the public Supabase access path may be able to:

- read business data
- insert records
- modify records
- delete records
- alter hardware/pricing information

depending on the exact grants and active remote policy state.

### Required fix

Production policies should be based on authenticated identity and role.

Do not depend only on frontend UI restrictions.

---

## SEC-002 — Public access to admin records

**Severity: P1**

`admin_users` currently has a policy allowing unrestricted `SELECT`.

Even if password hashes are not directly exposed through the UI, public access to administrative records is unnecessary information disclosure.

### Required fix

Restrict admin-user access to the appropriate authenticated administrative context.

---

## SEC-003 — API keys stored in localStorage

**Severity: P2**

The application stores configurable provider API keys in browser localStorage.

### Impact

Any JavaScript executing in the same origin can potentially read those keys.

LocalStorage should not be treated as a secure secret store.

### Required fix

For production provider credentials:

```text
Browser → serverless endpoint → provider API
```

with credentials stored in server-side environment variables.

If user-provided development keys must remain supported, clearly isolate that mode from production.

---

## SEC-004 — Public APIs lack strong abuse controls

**Severity: P2**

Relevant endpoints include:

- `api/ocr-bill.js`
- `api/scrape-solar-leads.js`
- `api/places-nearby.js`

The audits found no strong application-level rate limiting.

### Risks

- API abuse
- provider quota exhaustion
- excessive OCR processing
- scraping abuse
- unexpected serverless costs

### Required fix

Add:

- request size limits
- rate limiting
- timeout limits
- provider quotas
- input validation
- origin/access controls where appropriate

---

## SEC-005 — Broad CORS on public API

**Severity: P2**

`api/places-nearby.js` uses broad CORS behavior.

This is not automatically a vulnerability by itself, but combined with public expensive endpoints it increases abuse surface.

### Required fix

Restrict origins where the API does not intentionally need to be public.

---

# 4. Quotation Bugs & Data Integrity

## BUG-001 — `setSystemCapacity` ReferenceError on reset

**Severity: P1**

**Location:** `CreateQuotation.jsx`

Antigravity's runtime audit reports that the Reset Form flow calls:

```js
setSystemCapacity('3.3')
```

without a corresponding setter.

### Impact

Resetting the quotation form can throw:

```text
ReferenceError: setSystemCapacity is not defined
```

and push the UI into the Error Boundary.

### Required fix

Use the actual state setter for the system capacity state.

**Status:** Antigravity reports this as runtime-confirmed. Re-run after fixing to verify.

---

## BUG-002 — Shared customer quotation links are not portable

**Severity: P1**

**Locations:**

- `src/utils/quotationShare.js`
- `src/components/DealerPortal/QuotationPreview.jsx`

Generated links use:

```text
/?view=quote&id=<quotation-id>
```

But the current quotation preview primarily searches browser/local application state.

### Example failure

```text
Dealer device
   ↓
Creates quotation
   ↓
Shares WhatsApp link
   ↓
Customer opens link on another phone
   ↓
Customer browser does not have dealer's localStorage
   ↓
Quotation not found
```

### Required fix

Implement a dedicated read-only public quotation retrieval path:

```text
GET /api/public/quotations/:publicId
```

or equivalent Supabase-safe public query.

Only expose fields intended for the customer.

---

## BUG-003 — Quotation ID collision risk

**Severity: P1**

Current generation uses approximately:

```js
SV-2026-Q${Math.floor(100 + Math.random() * 900)}
```

That produces only **900 possible IDs**.

The persistence layer uses an upsert on the quotation ID.

### Impact

A collision can cause an existing quotation to be overwritten instead of creating a new quotation.

### Required fix

Use:

- UUID/database ID internally
- separate human-readable quotation number

If a sequential business number is required, generate it server-side.

---

## BUG-004 — Save failure can be displayed as success

**Severity: P1**

The persistence service can return:

```js
{ success: false, error: ... }
```

but the UI save flow does not consistently inspect the returned success value before showing a successful-save message.

### Impact

User may believe a quotation was safely saved when Supabase rejected it.

### Required fix

Only display success after the persistence operation returns success.

---

## BUG-005 — Supabase quotation persistence is not authoritative

**Severity: P1**

Quotation state is initialized from browser/localStorage state while cloud persistence is handled separately.

The current flow does not consistently hydrate the quotation state from Supabase on startup.

### Impact

Two stores can disagree:

```text
localStorage
     +
Supabase
```

A quotation saved in Supabase may not appear in another browser/session.

### Required fix

Use:

```text
Supabase = source of truth
localStorage = optional offline cache
```

and explicitly reconcile offline changes.

---

## BUG-006 — Rich quotation data can be lost

**Severity: P1**

The frontend quotation model contains more information than is currently represented in the persistent quotation schema/payload.

Potentially affected information includes:

- BOM details
- roof configuration
- design data
- hardware selections
- comparison data
- financial configuration

### Impact

Browser-local quotation state can contain information that cannot be fully reconstructed from the database.

### Required fix

Define a complete persistence contract.

Use structured columns/JSONB or normalized related tables for business-critical quotation information.

---

## BUG-007 — Duplicate quotation writes

**Severity: P2**

The context/domain action and the quotation form save flow can both call `saveQuotation()`.

### Impact

One user action can generate multiple database writes.

### Required fix

Use one persistence owner:

```text
UI
 ↓
domain/context action
 ↓
quotationService
 ↓
database
```

---

## BUG-008 — Quotation number hardcodes 2026

**Severity: P2**

Generated quotation IDs contain:

```text
SV-2026-Q...
```

### Required fix

Generate the year dynamically or generate the business number server-side.

---

# 5. Lead / Solar Radar Data Integrity

## LEAD-001 — Synthetic leads are presented as real data

**Severity: P1**

The audits found fallback logic that generates synthetic businesses, phone numbers, ratings and other fields.

Examples include fabricated:

- company names
- phone numbers
- coordinates
- ratings
- review counts

Some generated records are marked as verified.

### Impact

Dealers may contact nonexistent or incorrect businesses.

This is a product correctness issue, not merely a development concern.

### Required fix

When no real provider results exist:

```json
{
  "success": true,
  "count": 0,
  "leads": []
}
```

Do not generate fake production-looking leads.

If demo data is needed, explicitly mark:

```text
DEMO / SYNTHETIC
```

and keep it isolated from real leads.

---

## LEAD-002 — Provider fields are fabricated

**Severity: P1**

The places flow can assign values such as:

```text
rating
reviewsCount
businessStatus
isOpen
relevanceScore
```

without those values necessarily coming from the provider.

### Required fix

Use provider-supplied values only.

If unavailable:

```js
rating: null
```

not a fabricated number.

---

# 6. Performance

## PERF-001 — Monolithic 4.64 MB JavaScript bundle

**Severity: P2**

Antigravity's production build reported approximately:

```text
JavaScript: 4.64 MB raw
JavaScript: ~906 KB gzip
Total production output: ~5.82 MB
```

Major contributors include:

- Three.js
- Tesseract.js
- PDF generation libraries
- Gujarat GIS data
- application code

### Required fix

Use route/component-level lazy loading.

Example targets:

```text
CreateQuotation
SolarLeadsScraper
ElectricityBillOCR
RoofVisualizer3D
```

Also split large third-party dependencies.

---

## PERF-002 — Gujarat GIS database is large

**Severity: P2**

`src/data/gujaratDatabase.js` is approximately 1.8–1.85 MB.

### Required fix

Lazy-load it only when GIS/mapping functionality is opened.

---

## PERF-003 — Material Symbols font is very large

**Severity: P2**

The repository contains an approximately 4 MB Material Symbols font.

### Required fix

Prefer:

- subsetted icon font
- individual SVG/icon imports
- existing `lucide-react` icons

instead of shipping the complete font.

---

## PERF-004 — Large monolithic React components

**Severity: P2**

Examples include very large components such as:

- `PricingMaster.jsx`
- `CreateQuotation.jsx`
- `DealerManagement.jsx`
- `HardwareMaster.jsx`
- `AdminDashboard.jsx`

### Required fix

Split based on actual domain boundaries:

```text
Form state
Calculation logic
Tables
Modals
Visualization
Data fetching
```

Do not blindly fragment every component.

---

# 7. Mobile / Responsive

## MOBILE-001 — 3D canvas can capture page scrolling

**Severity: P2**

Antigravity's responsive test identified touch interaction conflicts in the 3D rooftop visualizer.

### Impact

A vertical page scroll beginning over the 3D canvas can be interpreted as a 3D gesture.

### Required fix

Possible approaches:

- explicit "Interact with 3D" mode
- touch overlay
- controlled pointer/touch activation
- carefully scoped OrbitControls settings

Do not simply disable all useful 3D controls without considering UX.

---

## MOBILE-002 — Small quotation filter controls

**Severity: P3**

Some filter/icon controls are below the recommended touch target size.

### Required fix

Target approximately:

```text
44 × 44 px
```

for primary touch controls.

---

## Responsive result

Antigravity reported **0 root horizontal overflow** across its tested viewports from approximately 320px through desktop sizes.

This is a positive result.

However, zero horizontal overflow does not prove that every mobile interaction is usable; the 3D gesture issue remains separate.

---

# 8. Accessibility

## A11Y-001 — Modal focus management

**Severity: P2**

Some modal/dialog components lack robust:

- focus trapping
- `aria-modal`
- dialog semantics
- focus restoration

### Required fix

Every interactive modal should have:

```text
role="dialog"
aria-modal="true"
```

and correct keyboard focus management.

---

## A11Y-002 — Icon buttons missing accessible names

**Severity: P3**

Some icon-only controls need explicit accessible labels.

### Required fix

Use:

```html
aria-label="Delete quotation"
```

or visible text where appropriate.

---

## A11Y-003 — Small interactive controls

**Severity: P3**

Increase touch targets and keyboard focus visibility.

---

# 9. UX

## UX-001 — PDF export lacks clear progress state

**Severity: P2**

PDF generation can be computationally expensive, but the user feedback does not clearly communicate progress.

### Required fix

Provide:

```text
Preparing PDF...
Generating...
Finalizing...
Downloaded
```

or an appropriate indeterminate progress state.

---

## UX-002 — OCR processing feedback

**Severity: P2**

OCR should clearly communicate that processing is active and should prevent accidental duplicate submissions.

---

## UX-003 — Destructive/reset action feedback

**Severity: P3**

Resetting a large quotation form should have clear confirmation or an easy undo path.

---

# 10. Architecture

## ARCH-001 — Monolithic AppContext

**Severity: P2**

`AppContext.jsx` is approximately 1,500+ lines and handles many unrelated domains.

### Problem

Changes to one state domain can cause broad context consumers to rerender.

### Recommended direction

Split by domain where profiling confirms the need:

```text
QuotationContext
InventoryContext
DealerContext
LeadContext
UIContext
```

Do not create unnecessary context layers just for file-size reduction.

---

# 11. Testing

## TEST-001 — No proper unit-test suite for critical calculations

**Severity: P1**

The audits found no mature Vitest/Jest/RTL suite covering the core calculation engine.

### Priority tests

At minimum:

- subsidy calculations
- DISCOM tariff calculations
- system sizing
- margin calculations
- quotation totals
- BOM totals
- edge capacities
- invalid/missing inputs

---

## TEST-002 — No automated RLS integration tests

**Severity: P1**

RLS is security-critical but should not be validated only by reading SQL.

### Required tests

Test:

```text
anonymous SELECT
anonymous INSERT
anonymous UPDATE
anonymous DELETE

dealer access
staff access
admin access
public quotation access
```

---

## TEST-003 — Stale version references

**Severity: P3**

Some hardening/test scripts still reference older application versions.

### Required fix

Read version from `package.json` instead of duplicating it.

---

# 12. DevOps

## DEVOPS-001 — CI branch trigger appears misspelled

**Severity: P2**

The repository does contain a GitHub Actions workflow, so Antigravity's statement that there is **no CI workflow** is outdated/incorrect.

However, the workflow appears to reference:

```yaml
devlopment
```

instead of:

```yaml
development
```

if `development` is the intended branch.

### Required fix

Verify the actual branch name and update the workflow trigger.

---

## DEVOPS-002 — CI should test more than build

**Severity: P2**

Current CI should be expanded beyond build verification.

Recommended sequence:

```text
install
↓
lint
↓
typecheck
↓
unit tests
↓
security/dependency audit
↓
production build
```

E2E can be added for critical flows afterward.

---

# 13. SEO / Metadata

The portal is primarily an enterprise/dealer application rather than a public content site, so SEO is lower priority.

Antigravity reports that:

- title/meta viewport exist
- OpenGraph/Twitter metadata exists
- PWA manifest exists

Potential issue:

## SEO-001 — Hardcoded canonical domain

**Severity: P3**

A hardcoded canonical URL can become incorrect when the application is deployed under another domain.

### Required fix

Make canonical configuration environment/deployment aware.

---

# 14. Deployment / Hosting

## DEPLOY-001 — Client-side hostname redirect

**Severity: P1/P2**

Antigravity found an inline redirect in `index.html` for Render hostnames.

Client-side hostname redirects are brittle compared with edge/CDN redirects.

### Required fix

Move environment/domain redirects to:

- Vercel configuration
- CDN/edge rules
- deployment configuration

where possible.

---

# 15. Potential Risks — Require Runtime Verification

These should **not** be treated as confirmed production bugs until verified:

1. Nominatim rate-limit/blocking risk under higher usage.
2. Tesseract.js memory pressure on low-RAM physical Android devices.
3. Supabase connection/traffic scaling under large numbers of public quotation viewers.
4. Exact live RLS behavior in the currently deployed Supabase project.
5. Exact third-party API quota behavior.
6. Exact browser behavior of 3D touch controls on physical devices.

---

# 16. Conflicts Between the Two Audits

## Conflict A — Authentication

Antigravity classified authentication bypasses as P0.

**Merged decision:** Excluded from current bug scoring because authentication is intentionally unfinished.

---

## Conflict B — GitHub Actions

Antigravity reported:

> No `.github/workflows` detected.

Independent repository inspection found:

```text
.github/workflows/ci.yml
```

**Merged decision:** CI exists. The actual issue is the suspicious `devlopment` branch trigger and limited CI coverage.

---

## Conflict C — Supabase Anon Key

Antigravity classified the frontend Supabase URL/Anon Key as a P0 secret leak.

**Merged decision:** A Supabase anon/public key is not equivalent to a service-role secret. The more serious issue is the **RLS configuration that makes public access dangerous**.

Therefore:

```text
Hardcoded anon key alone → not P0
Open RLS + public key → serious security issue
```

---

## Conflict D — Synthetic lead generation

Both audits identify synthetic lead generation.

**Merged decision:** Keep this as a confirmed P1 data-integrity issue.

---

## Conflict E — Public quotation links

Both audits identify the same fundamental problem.

**Merged decision:** Keep as P1 and prioritize alongside quotation persistence.

---

# 17. Final Prioritized Implementation Order

## Phase 1 — Critical Security

1. Fix Supabase RLS.
2. Restrict public CRUD on business tables.
3. Restrict admin-user access.
4. Secure expensive/public APIs.
5. Move production provider credentials server-side.

## Phase 2 — Quotation Correctness

6. Fix `setSystemCapacity` reset crash.
7. Replace random 900-value quotation IDs.
8. Fix false-success save state.
9. Make Supabase the authoritative quotation store.
10. Persist the complete quotation model.
11. Fix public quotation retrieval.
12. Remove duplicate quotation writes.

## Phase 3 — Lead Data Integrity

13. Remove synthetic production leads.
14. Stop fabricating ratings/reviews/status.
15. Clearly label any development-only demo data.

## Phase 4 — Performance

16. Lazy-load heavy modules.
17. Split Three.js/Tesseract/PDF dependencies.
18. Lazy-load Gujarat GIS data.
19. Reduce/subset icon font.
20. Profile large React contexts/components.

## Phase 5 — Mobile / UX / Accessibility

21. Fix 3D touch/scroll conflict.
22. Fix modal focus management.
23. Add accessible labels.
24. Increase small touch targets.
25. Improve PDF/OCR progress feedback.

## Phase 6 — Testing / DevOps

26. Add unit tests for solar calculations.
27. Add quotation calculation tests.
28. Add persistence tests.
29. Add RLS integration/security tests.
30. Fix CI branch trigger.
31. Expand CI to lint/typecheck/test/build.
32. Remove stale version references.

---

# 18. Production Readiness Gate

Before treating this application as production-ready, the following should pass:

### Security
- [ ] RLS verified with anonymous requests
- [ ] No unrestricted public CRUD on sensitive tables
- [ ] Admin records protected
- [ ] API rate limiting
- [ ] Server-side provider credentials
- [ ] Input validation and request limits

### Quotation
- [ ] Reset flow works
- [ ] Unique quotation IDs
- [ ] Save failure correctly shown
- [ ] Complete quotation survives browser restart
- [ ] Quotation appears on another device
- [ ] Public proposal link works from clean browser
- [ ] No duplicate save requests

### Lead data
- [ ] Zero fabricated production leads
- [ ] Provider fields are authentic
- [ ] Empty provider response produces empty results

### Performance
- [ ] Heavy features lazy-loaded
- [ ] Initial JS significantly reduced
- [ ] GIS data lazy-loaded
- [ ] Icon assets optimized

### Mobile
- [ ] 3D canvas does not hijack page scrolling
- [ ] Critical controls usable at 320px+
- [ ] Touch targets adequate

### Accessibility
- [ ] Modal focus trap
- [ ] Keyboard navigation
- [ ] Accessible icon labels
- [ ] Visible focus states

### Testing
- [ ] Solar calculation tests
- [ ] Quotation tests
- [ ] Persistence tests
- [ ] RLS tests
- [ ] CI executes tests before merge

---

# 19. Bottom Line

The two audits agree on the major application-level risks.

The most important corrections are **not the unfinished login system**.

The actual current priorities are:

```text
RLS / database security
        ↓
Quotation correctness & persistence
        ↓
Public quotation sharing
        ↓
Lead-data integrity
        ↓
Performance/bundle size
        ↓
Mobile + accessibility
        ↓
Automated testing + CI
```

The merged audit should be treated as the working defect backlog. Items explicitly marked as runtime-verification requirements should be confirmed before implementation if they cannot be reproduced from the source.

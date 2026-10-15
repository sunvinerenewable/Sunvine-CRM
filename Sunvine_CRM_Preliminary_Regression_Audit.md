# Sunvine CRM --- Branch Regression Audit Report

**Repository:** `https://github.com/sunvinerenewable/Sunvine-CRM`\
**Reference branch (reported working):** `sumit-updates`\
**Audit target branch (actual Git branch spelling):** `devlopment`\
**Report type:** Preliminary static audit / regression investigation\
**Date:** 2026-10-09\
**Change policy followed:** No code changes, database writes, or
deployment performed.

> **Important limitation:** This report is based on source-code
> inspection through GitHub. The automated test suite, live database
> schema/migrations, local runtime, browser end-to-end flow, and
> production reproduction were not executed. Findings are separated into
> observed code mismatches, likely defects, and items requiring runtime
> confirmation. Do not treat this report as proof that every issue
> occurs in production.

------------------------------------------------------------------------

## 1. Executive summary

The reported situation is that `sumit-updates` contains working
user-facing functionality, while `devlopment` has a more heavily refined
backend but some existing features stopped working after subsequent
backend changes.

The primary example is the quotation summary showing **0 units/year**,
**₹0/year**, and **0.0 years** for estimated annual generation, annual
savings, and payback.

The strongest audit approach is not to roll back the backend wholesale.
Instead, compare the known-working behaviour with the refined
implementation, then trace the same quotation through:

1.  Quotation form state
2.  Frontend generation/savings/payback calculation
3.  Create/update quotation request payload
4.  API validation and server-side recalculation
5.  Database serialization and persisted `quote_payload`
6.  API read/normalization path
7.  Quotation preview and PDF rendering
8.  Public/shared quotation route, if applicable

### Preliminary findings

Static source inspection identified these areas for focused
verification:

-   The backend constructs a new quotation payload and may not preserve
    all fields from the submitted quotation.
-   Public proposal response fields appear to use naming conventions
    that differ from fields consumed by the PDF template.
-   Frontend fallbacks for dealer margin and subsidy differ between
    branches.
-   Some tests appear to test simplified locally-defined validation
    functions rather than production API logic.
-   The generated public-link format can include a share token, while
    the public-view route appears to extract only an ID and the viewer
    calls the ID-based getter.
-   The public API response may omit company/banking data expected by
    the PDF template.

These are **static code findings**, not runtime-confirmed production
failures. Some appear to exist in both branches and therefore are not
necessarily regressions introduced by `devlopment`.

------------------------------------------------------------------------

## 2. Branch and audit context

  -----------------------------------------------------------------------
  Item                                Value
  ----------------------------------- -----------------------------------
  Repository                          `sunvinerenewable/Sunvine-CRM`

  Working/reference branch            `sumit-updates`

  Target branch                       `devlopment`

  User-reported change history        Branches were merged, followed by
                                      additional commits/backend changes

  Reported database/configuration     Same database and configuration

  Required output                     Detailed report only; no code
                                      changes

  Intended verification               Static inspection, tests, safe
                                      local E2E

  Verification actually completed     Static GitHub source inspection
  here                                only
  -----------------------------------------------------------------------

### Branch naming warning

The repository branch spelling observed during comparison was
`devlopment` (missing the second "e"), not `development`. Confirm the
exact deployed branch and Vercel/deployment configuration before running
any follow-up commands.

A branch comparison previously returned
`100 commits ahead / 1 commit behind` for `devlopment` relative to
`sumit-updates`. That indicates the histories are highly diverged; it
does **not** mean there are exactly 100 bugs or that all 100 commits are
relevant to this regression. Reconfirm the comparison at the time of the
next audit because branch heads can change.

Branch comparison URL:
`https://github.com/sunvinerenewable/Sunvine-CRM/compare/sumit-updates...devlopment`

------------------------------------------------------------------------

## 3. Severity and confidence definitions

-   **High:** Could materially break quotation generation, saved
    quotations, or customer-facing proposals; needs prompt verification.
-   **Medium:** Could create inconsistent financial results or break a
    particular fallback/route.
-   **Coverage gap:** Tests may not detect a production defect; not
    necessarily a runtime defect by itself.
-   **Confidence --- high:** The code mismatch itself is directly
    visible in inspected source.
-   **Confidence --- medium:** The code suggests a defect, but caller
    data, normalization, or runtime behaviour could change the outcome.
-   **Not confirmed:** Requires tests, runtime evidence, database
    evidence, or comparison against the actual business rule.

------------------------------------------------------------------------

## 4. Findings

### F-01 --- Quotation payload may discard fields needed by downstream views

**Severity:** High priority\
**Confidence:** Medium; payload construction is visible, runtime impact
not reproduced\
**Area:** API create/update path → persistence → read/preview

The `devlopment` implementation of `api/quotations.js` constructs a new
`quote_payload` containing server-calculated BOM and financial metadata.
The inspected payload construction does not visibly preserve a number of
frontend quotation fields, including examples such as:

-   `annualGenerationUnits`
-   `annualSavings`
-   `paybackYears`
-   Some detailed installation/hardware fields

**Potential impact**

-   A saved quotation may not retain all fields expected by the UI.
-   Reopening or previewing a saved quotation may show blank/default
    values or reconstruct values differently.
-   PDF and on-screen values may diverge from the values originally
    displayed in the form.
-   The issue may affect only some fields if they are reconstructed
    elsewhere.

**Evidence**

-   API quotation handling:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/api/quotations.js`
-   Quotation service:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/services/quotationService.js`

**Required verification**

1.  Capture the exact payload immediately before quotation save.
2.  Capture the API request body and successful response.
3.  Inspect the persisted row and nested `quote_payload` using read-only
    access.
4.  Fetch the same quotation through the normal UI API.
5.  Compare all relevant fields after normalization.
6.  Reopen the quotation and compare the summary values to the original
    form state.

**Do not assume the fix is simply to trust all client values.**
Server-side financial validation should remain authoritative. Preserve
only appropriate non-authoritative metadata while continuing to
calculate money and enforce business rules on the server.

------------------------------------------------------------------------

### F-02 --- Public proposal API field names may not match PDF template field names

**Severity:** High priority\
**Confidence:** High for the observed naming mismatch; runtime impact
not reproduced\
**Area:** Public API → PDF/template

The inspected public proposal response uses names such as:

-   `systemCapacityKw`
-   `annualGenerationKwh`

The PDF template appears to read names such as:

-   `systemCapacityKW`
-   `annual_generation_kwh`

JavaScript property names are case-sensitive. These names are not
interchangeable unless a normalization layer maps them.

**Potential impact**

-   Public proposal may fall back to a default capacity or generation
    value.
-   Values may differ between authenticated preview and public customer
    view.
-   Missing capacity/generation values may cause derived savings or
    payback to be wrong or zero.

**Evidence**

-   Public proposal response in API:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/api/quotations.js`
-   PDF template:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/components/DealerPortal/PDFTemplate.jsx`

**Required verification**

Create a field mapping table for every field passed from public API to
template. Verify capacity, annual generation, savings, payback, subsidy,
net cost, GSTIN, bank details, dealer details, customer details, and
BOM. Use one canonical internal representation and normalize at a clear
boundary.

------------------------------------------------------------------------

### F-03 --- Dealer margin fallback differs between branches

**Severity:** Medium\
**Confidence:** High that the inspected fallback differs; business-rule
correctness not confirmed\
**Area:** Quotation creation / pricing defaults

The inspected `sumit-updates` code falls back to approximately ₹4,500/kW
when a dealer tier's default margin is absent or zero. The corresponding
`devlopment` code appears to fall back to zero.

**Potential impact**

-   Dealers with incomplete/missing tier configuration may receive a
    lower margin than before.
-   Quotation totals may change silently depending on whether settings
    are populated.
-   Frontend and backend may apply different fallbacks.

This is a regression only if ₹4,500/kW is still the approved business
rule. A deliberate policy change to zero would make the difference
intentional, not a bug.

**Evidence**

-   Working/reference branch:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/sumit-updates/src/components/DealerPortal/CreateQuotation.jsx`
-   Target branch:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/components/DealerPortal/CreateQuotation.jsx`

**Required verification**

-   Ask the business owner to confirm the approved default margin and
    the expected behaviour when configuration is absent.
-   Test all dealer tiers with valid, zero, missing, and malformed
    margin configuration.
-   Confirm backend enforcement and frontend display use the same rule.
-   Do not restore a hardcoded margin until the business rule is
    confirmed.

------------------------------------------------------------------------

### F-04 --- Subsidy cap fallback differs between branches and may produce inconsistent net cost

**Severity:** Medium to High financial correctness risk\
**Confidence:** Medium; the inspected fallback differs, full settings
hydration not runtime-verified\
**Area:** Subsidy and final payable calculation

The inspected `sumit-updates` frontend calculation falls back to ₹78,000
when a configured subsidy cap is absent. In `devlopment`, the
`subsidyCap` value can resolve to zero if both pricing presets and
system settings omit the cap.

The target backend separately recalculates financial values using
server/database settings. This creates a risk of frontend/server
disagreement when settings are missing, malformed, or not loaded.

**Potential impact**

-   Net cost after subsidy may differ between form, saved quotation, and
    PDF.
-   The customer-facing final amount could be inconsistent with the
    dealer's displayed amount.
-   Missing settings may silently turn a subsidy into zero.

**Evidence**

-   Working/reference branch:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/sumit-updates/src/components/DealerPortal/CreateQuotation.jsx`
-   Target branch:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/components/DealerPortal/CreateQuotation.jsx`
-   Backend financial logic:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/api/quotations.js`

**Required verification**

1.  Confirm current approved subsidy formula, eligibility, cap, and
    scheme rules.
2.  Inspect settings loading and defaults for both branches.
3.  Compare frontend provisional calculation with the backend
    authoritative calculation.
4.  Test settings missing, null, zero, valid, and stale.
5.  Verify the saved quotation and PDF display the backend-authoritative
    result.

**Recommendation:** Avoid maintaining two independent sources of truth
for financial rules. The frontend can show a provisional estimate, but
the server response should be authoritative and clearly reconciled with
the UI.

------------------------------------------------------------------------

### F-05 --- Public share-token link may not use the token-based fetch path

**Severity:** High priority for public sharing\
**Confidence:** High for the observed flow mismatch; runtime result not
reproduced\
**Area:** WhatsApp/customer share link → public viewer → API

The inspected share URL builder can generate a URL resembling:

`/?view=quote&token=<share-token>`

However:

-   `App.jsx` determines whether the page is a public proposal from
    `view=quote` or `quoteId`.
-   The ID extraction logic reads `id` or `quoteId`, not `token`.
-   `PublicQuotationView.jsx` calls
    `quotationService.getQuotationById(publicQuoteId)`.
-   `quotationService.js` contains a separate
    `getPublicProposal(shareToken)` method, but the inspected viewer
    does not appear to call it.

**Potential impact**

-   A token-only share URL may open the public viewer with no quotation
    ID.
-   The public viewer may not fetch the intended quotation.
-   A token-based access design may not work as intended.

The same viewer pattern was present in both inspected branches, so this
appears to be a pre-existing issue rather than necessarily a
`devlopment` regression.

**Evidence**

-   App route detection and ID extraction:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/App.jsx`
-   Public viewer:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/components/PublicQuotationView.jsx`
-   Share URL generation:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/utils/quotationShare.js`
-   Public API/service method:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/services/quotationService.js`

**Required verification**

Test each supported link format separately: token link, ID link, legacy
hash route, and encoded-data link. Verify authorization,
expiration/revocation behaviour, and that public links expose only
intended fields. Do not make an ID-only lookup public merely to bypass
the broken token flow.

------------------------------------------------------------------------

### F-06 --- Public proposal response may omit company/banking fields required by PDF rendering

**Severity:** High priority for customer-facing proposals\
**Confidence:** Medium; depends on whether the template receives these
fields through another mapping\
**Area:** Public API → PDF validation/render

The inspected public API response appears to select a limited set of
quotation fields and BOM data. The PDF template has validation logic
that expects company information including GSTIN and bank-account
details.

**Potential impact**

-   The public proposal could show a missing-details state or fail to
    render the expected official quotation even though the data exists
    in the saved quotation.
-   Public and authenticated quotation views may behave differently.

**Evidence**

-   Public API handler:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/api/quotations.js`
-   PDF template:\
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/components/DealerPortal/PDFTemplate.jsx`

**Required verification**

Compare the exact response shape from the public API with the complete
set of fields consumed by the public view and PDF template. Confirm
which company/banking fields are intended to be public. Expose only
approved business details; do not blindly return private internal
settings.

------------------------------------------------------------------------

### F-07 --- Some security tests may test duplicated logic instead of production code

**Severity:** Medium (test coverage gap)\
**Confidence:** Medium to High based on the inspected test excerpt\
**Area:** Automated tests / security regression protection

In the inspected portion of `src/utils/__tests__/a1-quotations.test.js`,
some security tests define simplified validation functions inside the
test rather than importing and exercising the production API handler or
shared validation module.

**Potential impact**

A test can pass while production code behaves differently because the
test's local copy is not connected to the real implementation.

**Evidence**

`https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/utils/__tests__/a1-quotations.test.js`

**Required verification**

-   Identify tests that reimplement production validation.
-   Replace or supplement them with tests against actual exported
    production functions and API handlers.
-   Include integration tests for authentication, ownership, status
    restrictions, BOM validation, and financial recalculation.
-   Keep unit tests for pure functions, but do not treat them as proof
    of endpoint security.

------------------------------------------------------------------------

## 5. Main screenshot symptom: zero generation, savings, and payback

### Observed report

The quotation summary displays:

-   Estimated annual generation: `0 Units/Yr`
-   Estimated annual savings: `₹ 0 / Year`
-   Estimated payback: `0.0 Years`

### Current conclusion

**Root cause is not yet confirmed.** Static inspection found calculation
fallbacks, but that alone cannot establish why this quotation renders
zero. A valid positive system capacity should ordinarily result in
nonzero generation under normal positive-yield assumptions. Zero values
could originate from multiple points in the data flow.

### Root-cause hypotheses to test

  -------------------------------------------------------------------------
  Hypothesis              What to inspect           Evidence needed
  ----------------------- ------------------------- -----------------------
  Capacity is             Form state and saved      Runtime state and
  missing/zero            `systemCapacityKW` /      persisted record
                          related capacity fields   

  Settings/yield/tariff   System settings and       Read-only settings
  are missing or zero     defaults loaded into the  snapshot and
                          form                      calculation inputs

  Field-name mismatch     CamelCase vs snake_case   Exact JSON payload and
                          variants in API response  consumed field names
                          and template              

  Server payload omits    `quote_payload` created   Request payload vs API
  calculated values       by API                    response vs database
                                                    record

  Normalization drops     `normalizeQuotationRow`   Before/after object
  fields                  and row/payload mapping   comparison

  Async settings race     Whether calculation runs  Browser trace or
                          before settings finish    targeted component test
                          loading                   

  UI displays a different State source used by      Component props and
  object than the one     preview/PDF               selected quotation
  saved                                             object

  Deployment branch       Actual deployed commit vs Deployment metadata and
  differs                 inspected branch HEAD     commit SHA
  -------------------------------------------------------------------------

### Required trace for one affected quotation

Use a test quotation with non-sensitive dummy customer data, if
possible.

1.  Record system capacity, yield assumption, tariff, subsidy settings,
    and dealer margin used by the form.
2.  Record the three calculated values immediately before save.
3.  Record the exact request body sent to the quotation API.
4.  Record the API response after server-side recalculation.
5.  Inspect the persisted quotation row and nested payload using
    read-only access.
6.  Fetch the quotation through the normal application path.
7.  Record the normalized quotation object passed into the preview.
8.  Record the values consumed by `QuotationPreview` and `PDFTemplate`.
9.  Repeat through the public link path.
10. Compare the same field values at every boundary.

Do not paste production credentials, access tokens, customer identity
documents, or other secrets into the report.

------------------------------------------------------------------------

## 6. Regression audit matrix

This matrix defines the broader coverage needed to meet the requested
"all regressions" scope. The items below are **required audit areas**,
not claims that each area is already broken.

  ------------------------------------------------------------------------
  Area                     Checks required         Current status
  ------------------------ ----------------------- -----------------------
  Branch history           Merge base, changed     Partially inspected
                           files, commits          
                           affecting quotation     
                           flow                    

  Quotation creation       Required fields,        Partial static
                           default values,         inspection
                           settings loading, form  
                           validation              

  Generation calculation   Capacity × yield        Root cause not
                           assumptions, units,     confirmed
                           zero/null handling      

  Savings calculation      Generation ×            Root cause not
                           tariff/approved         confirmed
                           assumptions, rounding   

  Payback                  Cost basis, annual      Root cause not
                           savings, zero/negative  confirmed
                           handling                

  Subsidy                  Eligibility, cap,       Fallback mismatch found
                           server/client           
                           consistency             

  Dealer margin            Tier configuration and  Fallback mismatch found
                           missing-value defaults  

  BOM                      Allowed items,          Not fully audited
                           quantity/price          
                           validation, custom-line 
                           policy                  

  API validation           Schema validation,      Not fully audited
                           numeric bounds,         
                           malformed values        

  Authorization            Dealer ownership, role  Not fully audited
                           checks, edit/status     
                           restrictions            

  Database                 Schema, types,          Not verified
                           nullability, migration  
                           application             

  Serialization            Nested payload,         Potential mismatch
                           snake_case/camelCase    found
                           mapping                 

  Create/update            Field preservation and  Potential issue found
                           immutable identifiers   

  Read/list/detail         Normalization,          Not fully audited
                           pagination, status      
                           filters                 

  Preview                  State source, default   Partial static
                           values, field mapping   inspection

  PDF                      Required fields,        Partial static
                           financial values,       inspection
                           print/download flow     

  Public sharing           Token handling,         Flow mismatch found
                           expiry/revocation,      
                           least-privilege         
                           response                

  WhatsApp sharing         URL construction and    Partial static
                           supported route formats inspection

  Company settings         GSTIN/bank details and  Partial static
                           public exposure         inspection
                           boundaries              

  Notifications            Trigger conditions,     Not audited
                           duplicate events,       
                           failed delivery         

  File/document handling   Upload path,            Not audited
                           permissions, document   
                           categories              

  Authentication/session   Expiry, role changes,   Not audited
                           logout and API          
                           behaviour               

  Realtime/context         State refresh and stale Not audited
                           cache after writes      

  Tests                    Production-path         Test suite not run
                           unit/integration/E2E    
                           coverage                

  Deployment               Deployed branch, commit Not verified
                           SHA, environment        
                           variables               

  Performance              Concurrent requests,    Not tested
                           query count, large      
                           payloads                

  Accessibility/UI         Loading, empty, error,  Not tested
                           mobile layout           
  ------------------------------------------------------------------------

------------------------------------------------------------------------

## 7. Safe verification plan

### Phase A --- Freeze the evidence

-   Record current commit SHA for both branches.
-   Record the merge base and changed files.
-   Do not merge, reset, rebase, or modify either branch during the
    audit.
-   Confirm which branch/commit is deployed.
-   Use read-only database inspection only.

### Phase B --- Establish the working baseline

For each relevant feature, document:

-   User action
-   Expected result on `sumit-updates`
-   Actual result on `devlopment`
-   Inputs and configuration used
-   API request and response
-   Database fields read/written
-   Relevant commit(s) that changed behaviour

A feature should not be labelled a regression solely because the
implementations differ. Confirm expected business behaviour and test
results.

### Phase C --- Trace quotation calculations

Use fixed test inputs so both branches can be compared fairly. Include:

-   Positive capacity and normal settings
-   Missing settings
-   Explicit zero values
-   Null/undefined values
-   Numeric strings
-   Decimal capacity
-   Invalid or negative values
-   Dealer tiers with and without configured margins
-   Eligible and ineligible subsidy cases

Expected results should be derived from the approved business rules, not
guessed from a hardcoded fallback.

### Phase D --- Run automated tests

Not run during this inspection. On a safe local checkout:

1.  Install dependencies using the repository's documented
    lockfile-based process.
2.  Run the existing test command from `package.json`.
3.  Run build and lint/type checks if defined.
4.  Add focused regression tests for each confirmed mismatch.
5.  Ensure tests exercise production logic, not duplicated test-only
    implementations.

Capture command output and distinguish pre-existing failures from new
failures.

### Phase E --- End-to-end verification

Use a local/staging environment and dummy data. Verify:

1.  Create quotation
2.  View calculated summary
3.  Save quotation
4.  Reopen saved quotation
5.  Edit and update quotation
6.  View preview
7.  Generate/download PDF
8.  Open public customer link
9.  Test expired/invalid/revoked public token
10. Confirm access control with a different dealer account
11. Verify server totals match displayed totals
12. Confirm no unexpected writes to production

Do not run E2E actions against production if they create or modify
records.

### Phase F --- Report each confirmed issue

For each finding, capture:

-   ID and severity
-   Affected branch and commit SHA
-   Exact file and line range
-   Expected behaviour
-   Actual behaviour
-   Reproduction steps
-   Root cause
-   User/business impact
-   Regression vs pre-existing classification
-   Evidence from tests/logs
-   Suggested remediation
-   Regression test needed
-   Confidence level

------------------------------------------------------------------------

## 8. What is not yet proven

The following must remain explicitly marked **Not Verified** until
evidence is collected:

-   Whether the screenshot's three zero values are caused by a field
    mismatch, missing settings, zero capacity, async loading, or
    deployment drift.
-   Whether all listed code mismatches reproduce in the deployed
    environment.
-   Whether the live database has the expected schema and all required
    migrations applied.
-   Whether any existing automated tests pass or fail.
-   Whether the public quotation path fails for every token format.
-   Whether the margin/subsidy fallback changes violate the currently
    approved business rules.
-   Whether other application areas contain regressions outside the
    files inspected so far.

This is a preliminary audit report, not a declaration that the
repository has been exhaustively audited.

------------------------------------------------------------------------

## 9. Recommended priority order

1.  **P0 investigation:** Reproduce the zero generation/savings/payback
    values and trace one quotation end-to-end.
2.  **P1:** Verify payload preservation and API-to-template field
    mappings.
3.  **P1:** Verify public token flow and public proposal rendering.
4.  **P1:** Confirm server/client consistency for financial calculations
    and subsidy.
5.  **P2:** Confirm dealer-margin fallback policy.
6.  **P2:** Strengthen tests to exercise production API logic.
7.  **P2:** Continue module-by-module regression comparison across the
    remaining matrix.

No backend rollback is recommended based on static findings alone.
Preserve the refined backend's validation and security improvements
while identifying compatible fixes for confirmed regressions.

------------------------------------------------------------------------

## 10. Source links

-   Repository: `https://github.com/sunvinerenewable/Sunvine-CRM`
-   Branch comparison:
    `https://github.com/sunvinerenewable/Sunvine-CRM/compare/sumit-updates...devlopment`
-   Quotation API:
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/api/quotations.js`
-   Quotation service:
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/services/quotationService.js`
-   Quotation form:
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/components/DealerPortal/CreateQuotation.jsx`
-   Quotation preview:
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/components/DealerPortal/QuotationPreview.jsx`
-   PDF template:
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/components/DealerPortal/PDFTemplate.jsx`
-   Public app route:
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/App.jsx`
-   Public quotation view:
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/components/PublicQuotationView.jsx`
-   Share URL builder:
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/utils/quotationShare.js`
-   Quotation tests:
    `https://github.com/sunvinerenewable/Sunvine-CRM/blob/devlopment/src/utils/__tests__/a1-quotations.test.js`

------------------------------------------------------------------------

**Final status: PRELIMINARY STATIC AUDIT --- runtime, tests, database
and production behaviour not verified.**\
No code changes, database writes, or deployments were performed.

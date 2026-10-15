# Dealer Partner Management Skeleton — Pixel-Exact Implementation Plan

## 1. Findings Summary: Verified vs Corrected vs Unverified

### A. Verified Facts (Direct Codebase Inspection)
- **File Paths**:
  - `src/components/PortalApp.jsx` (Lines 1–225): App shell layout, top-level routes, navigation mounting, and Suspense fallback boundary.
  - `src/components/Shared/ViewSkeleton.jsx` (Lines 1–344): Route-level skeleton router delegating `activeTab === 'dealers_mgmt'` to `DealerDashboardSkeleton`.
  - `src/components/AdminPortal/DealerManagement.jsx` (Lines 1–2723): Full EPC Dealer Partner Management dashboard with all subcomponents, modals, and data hooks.
  - `src/components/AdminPortal/DealerSkeletons.jsx` (Lines 1–444): Skeleton loading representations for Header, Stats, Filters, Table Rows, Table, Card Grid, and Dashboard.
  - `src/components/ui/skeleton.jsx` (Lines 1–18): Base shadcn Skeleton primitive with `animate-pulse rounded-md bg-slate-200 dark:bg-slate-700`.
  - `src/lib/utils.js` (Lines 1–6): Standard `cn()` class merger using `clsx` and `tailwind-merge`.
  - `index.html` (Lines 1–232): Web font links, `@font-face` definitions, PWA manifests, and initial application boot shell.
- **Root Cause of Horizontal Layout Shift & Width Divergence**:
  - In `PortalApp.jsx` (L197–208), `<Suspense fallback={<ViewSkeleton activeTab={activeTab} />}>` is rendered directly inside `<main className="md:pl-64 pt-16 pb-24 md:pb-8...">` *outside* the inner container `<div className="p-3 sm:p-4 lg:p-6 xl:p-8 w-full max-w-[1600px] mx-auto min-w-0">`.
  - In `ViewSkeleton.jsx` (L170), `DealerDashboardSkeleton` renders `<div className="flex flex-col gap-6 w-full pb-16">` without the centering wrapper or padding.
  - On a 1920px viewport, this caused the skeleton to render at `x = 256px` with width `1664px`. When `DealerManagement` hydrated, it rendered inside the inner centered container at `x = 320px` with width `1536px` (a jarring 64px horizontal jump and 128px width collapse).
- **Exact Real Element Classes**:
  - **Breadcrumb** (`DealerManagement.jsx` L1310–1335): `flex items-center gap-1.5 text-xs font-label-xs text-secondary mb-2`.
  - **Page Title & Subtitle** (`DealerManagement.jsx` L1336–1341): Title `font-poppins font-bold text-headline-xl text-[#0F1B2E] tracking-tight`, Subtitle `text-body-md text-secondary mt-1`.
  - **Header Actions** (`DealerManagement.jsx` L1343–1372): 3 buttons:
    1. *Configure Tier Margins*: `h-10 px-3.5 sm:px-4 bg-white border border-[#E4E7EB] hover:border-primary text-on-surface font-label-md rounded-lg flex items-center gap-2 shadow-xs text-xs sm:text-sm`.
    2. *Export Directory*: `h-10 px-3.5 sm:px-4 bg-white border border-[#0F1B2E] text-[#0F1B2E] font-label-md rounded-lg flex items-center gap-2 shadow-xs text-xs sm:text-sm`.
    3. *+ Onboard New Dealer*: `h-10 px-3.5 sm:px-4 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-label-md font-semibold rounded-lg flex items-center gap-2 shadow-sm text-xs sm:text-sm`.
  - **KPI Cards** (`DealerManagement.jsx` L1375–1488): `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5`. Card container: `kpi-card bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm relative overflow-hidden flex flex-col justify-between`.
  - **Filter Card** (`DealerManagement.jsx` L1491–1608): `bg-white rounded-xl border border-[#E4E7EB] p-4 shadow-[0px_2px_8px_rgba(0,0,0,0.06)] space-y-3`.
  - **Table** (`DealerManagement.jsx` L1805–2063): 10 columns (`Dealer ID`, `Dealer / Firm Name`, `Region & DISCOM`, `Assigned Salesman`, `Pricing & Margin`, `Quotes`, `Files`, `Capacity Sold`, `Status`, `Actions`). Header row: `bg-[#0F1B2E] text-white text-label-xs uppercase tracking-wider h-11 select-none`. Real row height ≈ 92px. Exactly **5 action buttons** (`tune`, `key`, `block/check_circle`, `edit`, `delete`).
  - **In-page Hydration** (`DealerManagement.jsx` L1387, 1413, 1444, 1472, 1614, 1822): Dynamic slots render skeleton fallbacks when `dealers.length === 0 && isHardwareDbSyncing`.

### B. Corrected Claims (Corrections from Initial Draft)
1. **Button Gradient vs Solid Color**: Onboard button is solid `bg-[#6CBF3D]`, NOT `bg-gradient-to-r from-emerald-600 to-teal-500`.
2. **Card Borders & Backgrounds**: Surfaces use `bg-white rounded-xl border border-[#E4E7EB]`, NOT `bg-surface rounded-2xl border-outline/20`.
3. **Transparent Icons**: In `index.html`, icons use `color: inherit;` with `font-display: block;`. The old `color: transparent !important` rule was removed.
4. **Action Count**: Actions column in table row has **5 icon buttons**, NOT 4.
5. **Path Locations**: `PortalApp.jsx` is under `src/components/`, and `ViewSkeleton.jsx` is under `src/components/Shared/`.

### C. Unverified Facts (Environment Constraints)
- **Live DOM Headless getBoundingClientRect()**: Playwright and Puppeteer are not installed in the environment (execution returns "neither"). Live headless DOM measurements cannot be probed programmatically without installing packages. Therefore, target bounding rects are calculated via CSS Box Model geometry and verified against visual screenshot benchmarks (marked as "Calculated & Visual Benchmark").

---

## 2. File-by-File Change List

| File Path | Action | Lines | Detailed Rationale |
| :--- | :--- | :--- | :--- |
| `src/components/AdminPortal/DealerPageParts.jsx` | **CREATE (NEW)** | 1–280 | **Non-lazy shared module**. Houses static components (Breadcrumb, Header Title, 3 Disabled Header Buttons, Filter Toolbar static elements, Table Header columns, and Pagination footer layout) and shared constants (`DEFAULT_PAGE_SIZE = 15`, column widths, wrapper class tokens). Imported by both `DealerSkeletons.jsx` and `DealerManagement.jsx` without pulling the heavy `DealerManagement` bundle into the initial chunk. |
| `src/components/PortalApp.jsx` | **MODIFY** | 197–208 | Move the responsive centered wrapper (`p-3 sm:p-4 lg:p-6 xl:p-8 w-full max-w-[1600px] mx-auto min-w-0`) OUTSIDE the `<Suspense>` boundary, OR ensure `ViewSkeleton` renders inside an identical wrapper. Moving the wrapper to surround `<Suspense>` ensures all fallback views automatically inherit the exact desktop centering and padding. |
| `src/components/AdminPortal/DealerSkeletons.jsx` | **MODIFY** | 1–444 | Refactor to import static parts from `DealerPageParts.jsx`. Replace custom colors with neutral `bg-slate-200 dark:bg-slate-700 animate-pulse`. Align table skeleton to exactly 10 columns, 5 action buttons, and 15 rows. Ensure zero layout shift against loaded UI. |
| `src/components/AdminPortal/DealerManagement.jsx` | **MODIFY** | 1–45, 1308–1373, 1805–1820 | Import shared constants (`DEFAULT_PAGE_SIZE`, column definitions) and shared static primitives from `DealerPageParts.jsx` to ensure single source of truth for both loaded and loading states. |
| `src/components/Shared/ViewSkeleton.jsx` | **MODIFY** | 160–172 | Ensure `activeTab === 'dealers_mgmt'` cleanly maps to `DealerDashboardSkeleton` with proper wrapper sizing. |
| `src/components/ui/skeleton.tsx` | **DELETE** | 1–25 | Delete redundant, unreferenced TypeScript duplicate file (`skeleton.jsx` is the canonical component used by the project). |

---

## 3. Phase-Wise Implementation Order

### Phase 1: Shell & Container Parity (Zero CLS Guarantee)
- **Action**: Fix `PortalApp.jsx` wrapper hierarchy.
- **Verification**: Ensure fallback and loaded view share identical outer container:
  `<div className="p-3 sm:p-4 lg:p-6 xl:p-8 w-full max-w-[1600px] mx-auto min-w-0">`.
- **Quality Gate**: `npm run build` passes with 0 errors.

### Phase 2: Non-Lazy Shared Primitives (`DealerPageParts.jsx`)
- **Action**: Create `DealerPageParts.jsx` containing:
  - `DealerBreadcrumb`
  - `DealerHeaderTitle`
  - `DealerHeaderActions` (renders active buttons in real page, disabled buttons in skeleton)
  - `DealerTableHeader` (exact 10 columns and widths)
  - `DEALER_VIEW_WRAPPER_CLASSES`, `DEFAULT_PAGE_SIZE = 15`, `ROW_HEIGHT = 92`.
- **Quality Gate**: `npm run build` passes with 0 errors. Rollup manual chunks verify zero chunk-bloat.

### Phase 3: Header & 4 KPI Cards Parity
- **Action**: Update `DealerHeaderSkeleton` and `DealerStatsSkeleton` in `DealerSkeletons.jsx`.
  - Retain real static labels ("TOTAL REGISTERED DEALERS", "ACTIVE & QUOTING", etc.).
  - Replace value slots with neutral `Skeleton` (`h-9 w-12`, `h-6 w-24`, etc.).
  - Retain real 36x36px icon wrappers.
- **Quality Gate**: `npm run build` passes with 0 errors.

### Phase 4: Filter Toolbar & Quick Tabs Parity
- **Action**: Update `DealerFiltersSkeleton` in `DealerSkeletons.jsx`.
  - Search input: exact 448px max-width, `h-10`, real placeholder text.
  - 4 Select dropdowns: real static default labels.
  - Quick Tabs: real text ("All", "Active", "Pending KYC", "Suspended") with Skeleton count badges.
  - Table/Cards toggle: real toggle buttons.
- **Quality Gate**: `npm run build` passes with 0 errors.

### Phase 5: Table & 5-Action Row Parity
- **Action**: Update `DealerTableSkeletonRows` and `DealerTableSkeleton`.
  - Exact 10 columns matching `DealerManagement.jsx`.
  - 15 rows default (matching `DEFAULT_PAGE_SIZE`).
  - Row height locked to 92px.
  - Actions cell: exactly 5 icon slots (`w-7 h-7 rounded`).
- **Quality Gate**: `npm run build` passes with 0 errors.

### Phase 6: In-Page Hydration Parity (`isHardwareDbSyncing`)
- **Action**: Update `DealerManagement.jsx` to use shared skeleton slots from `DealerSkeletons.jsx` when `dealers.length === 0 && isHardwareDbSyncing`.
- **Verification**: Data hydration seamlessly replaces skeleton badges with numbers without container expansion.
- **Quality Gate**: `npm run build` passes with 0 errors.

### Phase 7: Assets & Cleanup
- **Action**:
  - Delete `src/components/ui/skeleton.tsx`.
  - Verify `index.html` icon preload and local font `@font-face` definitions.
- **Quality Gate**: `npm run build` passes with 0 errors, Git status clean.

---

## 4. Per-Section Target Rects (1920 × 930 Viewport)

*Reference: Desktop 1920px width, 256px sidebar, 32px centering margin, 32px inner padding (`xl:p-8`). Content starts at `x = 320px`, width = `1536px`.*

| Section / Element | Target X (px) | Target Y (px) | Target W (px) | Target H (px) | Skeleton Dimensions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Desktop Topbar** | 256 | 0 | 1664 | 64 (bottom ~67) | Real static topbar in shell |
| **Breadcrumbs** | 320 | 96 | 480 | 16 (bottom ~112) | Real static breadcrumbs |
| **Title & Subtitle** | 320 | 120 | 720 | 64 (bottom ~184) | Real static text |
| **3 Header Action Buttons** | 1084 | 120 | 772 | 40 | Real disabled buttons (218px, 173px, 217px) |
| **KPI Card 1 (Total Registered)** | 320 | 208 | 369 | 165 | Metric: `h-9 w-12`, Badge: `h-6 w-24` |
| **KPI Card 2 (Active & Quoting)** | 709 | 208 | 369 | 165 | Metric: `h-9 w-12`, Badge: `h-6 w-28` |
| **KPI Card 3 (Pending KYC)** | 1098 | 208 | 369 | 165 | Metric: `h-9 w-12`, Badge: `h-6 w-20` |
| **KPI Card 4 (Suspended)** | 1487 | 208 | 369 | 165 | Metric: `h-9 w-12`, Badge: `h-6 w-20` |
| **Filter Card (2 Rows)** | 320 | 397 | 1536 | 137 | Real inputs & selects, Badge: `h-4 w-6` |
| **Table Header** | 320 | 558 | 1536 | 44 (h-11) | Real static table header row |
| **Table Row 1** | 320 | 602 | 1536 | 92 | 10 cells, 5 action buttons (w-7 h-7) |
| **Table Row 2** | 320 | 694 | 1536 | 92 | 10 cells, 5 action buttons (w-7 h-7) |
| **Table Row 3** | 320 | 786 | 1536 | 92 | 10 cells, 5 action buttons (w-7 h-7) |
| **Pagination Footer** | 320 | 1982 | 1536 | 56 | Real disabled pagination bar |

---

## 5. Responsive Behavior Across Breakpoints

| Breakpoint | Width (px) | Layout Adjustments | Skeleton Behavior |
| :--- | :--- | :--- | :--- |
| **Ultra-Wide Desktop** | 1920px | Sidebar fixed 256px, content max 1600px centered (32px auto-margin + 32px padding). 4 KPI cards, 10 table columns. | Exact 1:1 match with 1536px content width. |
| **Standard Desktop** | 1440px | Sidebar fixed 256px, content takes remaining 1184px (p-6 = 24px padding -> 1136px width). 4 KPI cards, horizontal scroll on table. | Grid 4 columns, table container `overflow-x-auto`. |
| **Tablet** | 768px | Sidebar collapses to drawer. Content full width with `sm:p-4` (16px). 2 KPI columns. | Grid 2 columns (`sm:grid-cols-2`). Table horizontal scroll. |
| **Mobile** | 375px | Content full width with `p-3` (12px). Header action buttons wrap vertically. 1 KPI column. Card view preferred. | Single column KPI (`grid-cols-1`). Action buttons wrap. |

---

## 6. Verification Harness & Acceptance Criteria

### A. Development-Only Verification Switch
- Add support for URL query parameter: `?skeleton=1` or `?mockLoading=1` in `PortalApp.jsx` / `DealerManagement.jsx`.
- When present, locks the page in skeleton loading mode indefinitely, allowing visual inspection and pixel measurement without requiring network throttling.

### B. DOM Attributes for Inspection
- Mark skeleton elements with `data-skel="[element-name]"` (e.g. `data-skel="kpi-card-1"`, `data-skel="table-row-1"`).
- Mark real elements with `data-real="[element-name]"`.

### C. Automated Rect-Diff Verification Script
- Browser console script to run on both states and compute `| real.rect - skel.rect |`:
  ```javascript
  const compareNodes = (realSelector, skelSelector) => {
    const r = document.querySelector(realSelector)?.getBoundingClientRect();
    const s = document.querySelector(skelSelector)?.getBoundingClientRect();
    if (!r || !s) return console.error('Nodes not found', { r, s });
    const diff = {
      x: Math.abs(r.x - s.x),
      y: Math.abs(r.y - s.y),
      w: Math.abs(r.width - s.width),
      h: Math.abs(r.height - s.height)
    };
    console.table({ real: r, skel: s, diff });
  };
  ```

### D. Acceptance Criteria
1. **Bounding Box Variance**: Every major node's delta `|real - skel| <= 2px` on `1920x930`.
2. **Cumulative Layout Shift (CLS)**: CLS score < 0.01 upon chunk resolution and data arrival.
3. **Zero Horizontal Overflow**: `document.documentElement.scrollWidth === window.innerWidth` across all viewports (375px to 1920px).
4. **Theme Parity**: Consistent neutral contrast in both light mode and dark mode.
5. **Build Status**: `npm run build` passes with 0 errors.

---

## 7. Risks, Rollback, and Open Decisions

### Risks & Mitigations
- **Bundle Chunk Leakage Risk**: If `DealerPageParts.jsx` accidentally imports any state hook, helper, or modal from `DealerManagement.jsx`, Vite will pull the entire 2,700-line DealerManagement chunk into the entry bundle.
  - *Mitigation*: `DealerPageParts.jsx` will be strictly pure, stateless, and only export static JSX, icons, and constants.
- **Font FOUT on Slow 3G**: If Material Symbols takes >2s to render, icon placeholders could cause micro-jumps.
  - *Mitigation*: Preloaded in `index.html` with explicit width/height containers (`w-5 h-5` / `w-7 h-7`) and `font-display: block`.

### Rollback Strategy
- All changes are isolated to `DealerPageParts.jsx`, `DealerSkeletons.jsx`, `PortalApp.jsx`, and `DealerManagement.jsx`. If issues arise, Git revert returns the code to the working branch state cleanly.

---

## 8. Appendix: Audit Corrections Summary
For detailed historical audit findings and corrections log, see [`docs/SKELETON_AUDIT.md`](file:///e:/repos/dealer-portal-quotation/docs/SKELETON_AUDIT.md#0-audit-corrections--verification-log-post-deep-scan).
Key verified facts:
1. `PortalApp.jsx` path: `src/components/PortalApp.jsx`.
2. `ViewSkeleton.jsx` path: `src/components/Shared/ViewSkeleton.jsx`.
3. CLS root cause: `<Suspense>` placed outside `<div className="p-3...max-w-[1600px] mx-auto">`.
4. Buttons: 5 row actions, solid `#6CBF3D` primary onboarding button.
5. Skeletons: Pure `bg-slate-200 dark:bg-slate-700` neutral shading.

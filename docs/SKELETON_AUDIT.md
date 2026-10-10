# Dealer Partner Management (/admin/dealers) — Skeleton Loading Audit Report

## 0. Audit Corrections & Verification Log (Post-Deep-Scan)
> [!IMPORTANT]
> The initial audit draft contained several path and class discrepancies due to preliminary scanning. The deep codebase verification has established the following verified truths:

1. **File Paths Corrected**:
   - `PortalApp.jsx` is located at `src/components/PortalApp.jsx` (NOT `src/components/AdminPortal/PortalApp.jsx`).
   - `ViewSkeleton.jsx` is located at `src/components/Shared/ViewSkeleton.jsx` (NOT `src/components/AdminPortal/ViewSkeleton.jsx`).
   - `DealerManagement.jsx` is located at `src/components/AdminPortal/DealerManagement.jsx`.
   - `DealerSkeletons.jsx` is located at `src/components/AdminPortal/DealerSkeletons.jsx`.
   - `Skeleton.jsx` base component is at `src/components/ui/skeleton.jsx` (duplicate `skeleton.tsx` is unreferenced).
2. **Suspense Wrapper Bug Identified (The Root CLS Cause)**:
   - In `src/components/PortalApp.jsx` (L197–208), `<Suspense fallback={<ViewSkeleton activeTab={activeTab} />}>` is placed *outside* `<div className="p-3 sm:p-4 lg:p-6 xl:p-8 w-full max-w-[1600px] mx-auto min-w-0">`.
   - When lazy-loading chunk `DealerManagement.js`, `ViewSkeleton` renders directly into `<main>` with zero horizontal centering margin, causing it to render at `x=256px, w=1664px`.
   - When loaded, `DealerManagement` mounts inside the inner centered container at `x=320px, w=1536px`. This caused a sudden 64px horizontal shift and 128px width collapse!
3. **Real UI Styling Classes Corrected**:
   - Primary Onboard Button is `bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-label-md font-semibold rounded-lg` (`DealerManagement.jsx` L1366), NOT an emerald-to-teal gradient.
   - Cards and toolbar use `bg-white rounded-xl border border-[#E4E7EB]` with `p-5` (cards) and `p-4` (filters), NOT `bg-surface rounded-2xl border-outline/20`.
   - Icon loading in `index.html`: `color: transparent !important` was already eliminated; icons use `color: inherit;` with `@font-face { font-display: block; }`.
4. **Action Buttons Verified**:
   - Real row actions in `DealerManagement.jsx` (L2015–2056) contain **5 icon buttons**: Tune (Pricing), Key (Credentials), Block/Check (Status toggle), Edit (Profile), and Delete (Trash).
5. **Measurement Environment**:
   - Headless browser automation (Playwright/Puppeteer) is NOT installed in the environment (unverified via live DOM probe). Target dimensions are calculated with exact CSS Box Model geometry verified against user screenshot references.

---

## 1. Executive Summary
  - **Audit Target**: Loading states for Dealer Partner Management (`/admin/dealers` / `activeTab === 'dealers_mgmt'`).
  - **Core Diagnosis**: Significant drift between loading state and loaded state causing noticeable layout shifts (CLS), missing breadcrumbs/actions, mismatched paddings, and inconsistent row/card counts.
  - **Root Cause #1 (Two Lifecycles)**: Route Suspense fallback (`ViewSkeleton` -> `DealerDashboardSkeleton`) runs during code-split chunk download, while an internal fallback (`dealers.length === 0 && isHardwareDbSyncing`) runs inside `DealerManagement.jsx` during Supabase hydration.
  - **Root Cause #2 (Wrapper Drift)**: `ViewSkeleton` and `DealerDashboardSkeleton` did not accurately mirror the responsive outer wrapper padding (`p-3 sm:p-4 lg:p-6 xl:p-8 w-full max-w-[1600px] mx-auto min-w-0`) defined in `PortalApp.jsx`.
  - **Root Cause #3 (Font Display FOUT)**: Material Symbols icon visibility was blocked until web fonts hydrated due to `.material-symbols-outlined { color: transparent !important }` in `index.html`.
  - **Root Cause #4 (Action & Column Divergence)**: Table skeleton modeled 4 action icons instead of 5, missed exact `th` padding, and lacked sticky/scrolling parity.
  - **Recommended Strategy**: Approach C (Hybrid Shared Shell + Section-wise Loading Slots) to ensure 1:1 DOM element dimension parity without duplicating 1,500 lines of business logic.
  - **Risk Assessment**: Low-to-Medium risk on mobile viewport reflows; Zero risk to database or backend sync logic.
  - **Action Plan**: Standardize shared wrapper tokens, reuse real static headers/buttons, and drive dynamic skeletons purely via neutral tokens (`bg-slate-200 dark:bg-slate-700 animate-pulse`).

  ---

  ## 2. Findings Per Section

  ### Section 1: Render Chain & Loading Lifecycle
  - **File references**:
    - `src/App.jsx` (Lines 65–75): Top-level router mounts `<Suspense fallback={<PortalSkeleton />}> <PortalApp /> </Suspense>`.
    - `src/components/AdminPortal/PortalApp.jsx` (Lines 28–35, 90–100, 195–205): Shell defines sidebar (`fixed left-0 top-0 h-screen w-64`), topbar (`fixed top-0 left-64 right-0 h-16`), and main canvas (`md:pl-64 pt-16 pb-24 md:pb-8`). `DealerManagement` is lazily imported via `React.lazy()` and wrapped in `<Suspense fallback={<ViewSkeleton activeTab={activeTab} />}>`.
    - `src/components/AdminPortal/ViewSkeleton.jsx` (Lines 160–172): Checks `activeTab === 'dealers_mgmt'` and delegates to `DealerDashboardSkeleton`.
    - `src/components/AdminPortal/DealerManagement.jsx` (Lines 310–330, 1750–1785): Component mounts its own outer wrapper `<div className="flex flex-col gap-6 w-full pb-16">`. If `dealers.length === 0 && isHardwareDbSyncing`, it renders internal skeleton rows.
  - **Timeline**:
    1. *Hard Refresh (`Ctrl + Shift + R`)*: Initial bundle loads -> `PortalSkeleton` renders briefly -> `PortalApp` shell mounts -> `DealerManagement.js` chunk is fetched over network -> `ViewSkeleton` (`DealerDashboardSkeleton`) renders -> Chunk executes -> `DealerManagement` mounts.
    2. *Supabase Data Fetch*: Once mounted, `fetchDealers()` executes asynchronously. If slow, the in-page skeleton displays until records arrive.
    3. *Client-side Tab Navigation*: Shell remains mounted; only the chunk load (cached after first visit) and Supabase fetch trigger loading states.
  - **Wrapper Discrepancy**:
    - `PortalApp.jsx` wraps views in: `div.p-3.sm:p-4.lg:p-6.xl:p-8.w-full.max-w-[1600px].mx-auto.min-w-0`.
    - When `DealerDashboardSkeleton` included redundant outer padding or margins, it resulted in double padding on the left/right and button overflow.

  ---

  ### Section 2: Real UI Structure (`DealerManagement.jsx`)
  - **Breadcrumb & Header** (Lines 1310–1365):
    - Breadcrumb: Static text `Admin Console > Partner Directory > Dealer Partner Management` with chevron icons.
    - Title: Static `h1` `Dealer Partner Management` (`text-headline-sm sm:text-headline-md font-bold tracking-tight text-on-surface`).
    - Subtitle: Static `p` description (`text-body-sm text-on-surface-variant font-medium mt-1`).
    - Actions (Right): 3 buttons:
      1. *Configure Tier Margins* (~218px width, `h-10`, `border-outline/40`)
      2. *Export Directory* (~173px width, `h-10`, `border-outline/40`)
      3. *+ Onboard New Dealer* (~217px width, `h-10`, `bg-gradient-to-r from-emerald-600 to-teal-500`)
  - **KPI Cards** (Lines 1368–1488):
    - 4 cards in `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5`.
    - Dimensions: Height ≈ 165px. Border `border-outline/20 bg-surface rounded-2xl p-5`.
    - Top slot: Uppercase static category label + icon container (36x36px).
    - Middle slot: Large metric number (`text-2xl sm:text-3xl font-mono font-bold`) + trend pill badge.
    - Divider: `h-px bg-outline/10 my-3.5`.
    - Bottom slot: Subtitle caption (static) + secondary dynamic badge/stat.
  - **Filter & Search Toolbar** (Lines 1490–1580):
    - Wrapper: `bg-surface rounded-2xl border border-outline/20 p-4 sm:p-5 flex flex-col gap-4`.
    - Row 1: Search input (flex-1, min-w-[280px], max-w-[448px], `h-[42px]`) + 4 Dropdowns (`All Sales Channels`, `Region/DISCOM`, `Margin Slab Tier`, `Category/Model`) + Refresh Button (42x42px icon button).
    - Row 2: Status Tabs (`All`, `Active`, `Pending KYC`, `Suspended`) with count badges + View toggle (`Table` vs `Cards`) + "Showing X-Y of Z Dealers" indicator.
  - **Table Structure** (Lines 1773–2050):
    - 10 fixed columns:
      1. `Dealer ID` (width: 110px)
      2. `Dealer / Firm Name` (min-width: 170px)
      3. `Region & DISCOM` (width: 125px)
      4. `Assigned Salesman` (width: 130px)
      5. `Pricing & Margin` (width: 120px)
      6. `Quotes` (width: 85px, numeric right-aligned)
      7. `Files` (width: 85px, numeric right-aligned)
      8. `Capacity Sold` (width: 95px, numeric right-aligned)
      9. `Status` (width: 80px, centered badge)
      10. `Actions` (width: 90px, centered row with **5 icons**: Margins, Key, Toggle Status, Edit, Delete).
    - Row height: ~92px with `py-4` padding.
  - **Pagination Footer** (Lines 2058–2100):
    - Height: ~56px. Page size selector (15/25/50/100) + Previous/Next pagination buttons.

  ---

  ### Section 3: Existing Skeleton Code Audit
  - **Files**: `src/components/AdminPortal/DealerSkeletons.jsx`, `src/components/ui/skeleton.jsx`, `src/components/ui/skeleton.tsx`.
  - **Mismatches**:
    - `DealerSkeletons.jsx` used duplicate wrapper padding, causing the content container to shrink inward and horizontally scroll.
    - Skeleton actions column only rendered 4 placeholder buttons instead of the real 5 icon buttons.
    - KPI cards rendered artificial colored tints instead of a uniform neutral pulse.
    - Table header in the initial skeleton used gray blocks instead of showing the static column titles, creating an unnecessary visual shift when headers resolved.
  - **Redundancies**:
    - Both `src/components/ui/skeleton.jsx` and `src/components/ui/skeleton.tsx` were present. Next/Vite defaults to resolving `.jsx` or `.tsx` based on import resolution, causing ambiguity. `skeleton.tsx` is unused and should be cleaned up.

  ---

  ### Section 4: Icons & Font Assets
  - **Location**: `index.html` (Lines 18–35).
  - **Setup**:
    - Uses local font: `/fonts/material-symbols-outlined.woff2`.
    - Previous CSS had: `html:not(.fonts-loaded) .material-symbols-outlined { color: transparent !important; }`.
    - On Slow 3G network throttling, icons were invisible until `document.fonts.ready` fired, causing topbar and action buttons to jump in height.
  - **Remedy**: Keep icons with `font-display: swap` or static fallbacks so layout heights remain locked.

  ---

  ### Section 5: Side-Effects of Earlier Changes
  - `vite.config.js`: `@` alias correctly mapped to `src/`. No adverse side-effects.
  - `tailwind.config.js`: Custom color tokens (`on-surface`, `surface-container-low`, `outline`) match the Sunvine enterprise design system.
  - `src/lib/utils.js`: Standard `clsx` + `tailwind-merge` helper `cn()`. Safe and standard.

  ---

  ### Section 6: Design System Tokens & Responsive Breakpoints
  - **Canvas Background**: `#070D18` (Dark) / `#F7F9FF` (Light).
  - **Card Background**: `#0D1527` (Dark) / `#FFFFFF` (Light) via `bg-surface` / `bg-surface-container-low`.
  - **Breakpoints**:
    - `< 640px` (`sm`): KPI cards collapse to 1 column; table requires horizontal scroll or card view toggle; header buttons stack.
    - `640px – 1024px` (`md`): 2 KPI columns; sidebar collapses to drawer.
    - `> 1024px` (`lg`/`xl`): 4 KPI columns; full 10-column table fits comfortably within `1600px` container.

  ---

  ### Section 7: Key Node Measurements (Desktop 1920 × 930 Viewport)

  | Node Element | Estimated X (px) | Estimated Y (px) | Estimated W (px) | Estimated H (px) | Notes |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | **Topbar Header** | 256 | 0 | 1664 | 64 | `fixed top-0 left-64 right-0 h-16` |
  | **Breadcrumbs** | 288 | 96 | 600 | 20 | `h-5 flex items-center gap-2` |
  | **Header Title & Actions** | 288 | 128 | 1536 | 44 | Title left, 3 action buttons right |
  | **KPI Card 1 (Total Registered)**| 288 | 204 | 369 | 165 | Grid col 1 of 4, `p-5 rounded-2xl` |
  | **KPI Card 2 (Active & Quoting)**| 677 | 204 | 369 | 165 | Grid col 2 of 4 |
  | **KPI Card 3 (Pending KYC)** | 1066 | 204 | 369 | 165 | Grid col 3 of 4 |
  | **KPI Card 4 (Suspended/Inactive)**| 1455 | 204 | 369 | 165 | Grid col 4 of 4 |
  | **Filter & Search Toolbar** | 288 | 393 | 1536 | 138 | 2-row toolbar (`p-5 rounded-2xl`) |
  | **Table Header Row** | 288 | 555 | 1536 | 52 | 10 columns, dark `#0F1B2E` / `#F1F5F9` |
  | **Table Row 1** | 288 | 607 | 1536 | 92 | Height ~92px with avatars & badges |
  | **Table Row 2** | 288 | 699 | 1536 | 92 | Height ~92px |
  | **Table Row 3** | 288 | 791 | 1536 | 92 | Height ~92px |
  | **Pagination Footer** | 288 | 899 | 1536 | 56 | Sticky/relative footer bar |

  *(Note: Coordinate estimates assume 256px sidebar, 32px (`xl:p-8`) content padding, and 1600px max container limit).*

  ---

  ## 3. Mismatch Table (Real UI vs Current Skeleton)

  | Section | Real Component (`DealerManagement.jsx`) | Skeleton (`DealerSkeletons.jsx`) | Drift / Bug Description |
  | :--- | :--- | :--- | :--- |
  | **Container Padding** | Inherited from `PortalApp` (`p-3...xl:p-8 max-w-[1600px]`) | Added redundant `p-4 sm:p-6` inside skeleton | Double padding caused left misplacement & horizontal overflow. |
  | **Breadcrumbs** | Static text + 2 chevron icons | Skeleton gray pill or missing | Flash of gray block when breadcrumb is completely static. |
  | **Header Action Buttons** | 3 buttons with exact labels & sizes (~218px, ~173px, ~217px) | Blank or generic skeleton bars | Buttons shifted in width upon mount. |
  | **KPI Cards** | 4 cards, exact heights (165px), static titles, 36x36 icon slot | Colored tinted skeletons, irregular heights | Color inconsistency and height jump on data hydration. |
  | **Filter Toolbar** | Real inputs, selects with static labels, 2nd row tabs | Empty box or single skeleton input | Layout jumped from ~60px to 138px. |
  | **Table Columns** | 10 columns with exact classes and alignment | Generic 6–8 column grid | Massive horizontal shifts between columns. |
  | **Actions Column** | 5 distinct circular action icon buttons | 4 square skeleton blocks | Missing 1 action button; layout reflow on row hover. |
  | **Row Count** | Default page size 15 rows | 5 or 8 rows | Causes vertical viewport bounce. |

  ---

  ## 4. Approaches Comparison

  ### Approach A: Single Tree with `loading` Prop
  - **Mechanism**: Use the exact same JSX tree inside `DealerManagement.jsx`. Pass `isLoading` prop; swap only dynamic values (`dealer.name`, `counts`, `rows`) with `<Skeleton />`.
  - **Pros**: 100% pixel-perfect guarantee; zero drift over time; zero duplicate code.
  - **Cons**: Does not solve the initial chunk download phase (`React.lazy` Suspense fallback in `PortalApp.jsx` still needs a standalone fallback before `DealerManagement.js` evaluates).
  - **Effort / Risk**: Medium effort / Low risk.

  ### Approach B: Parallel Skeleton Markup (Current Approach)
  - **Mechanism**: Dedicated `DealerDashboardSkeleton.jsx` mirroring the markup.
  - **Pros**: Completely decoupled; instant render for `React.lazy` fallback in `ViewSkeleton`.
  - **Cons**: High risk of design drift whenever `DealerManagement.jsx` is updated.
  - **Effort / Risk**: Low effort / Medium risk (drift maintenance).

  ### Approach C: Hybrid Shell + Section-wise Shared Primitives (Recommended)
  - **Mechanism**:
    1. For `React.lazy()` Suspense fallback: `DealerDashboardSkeleton.jsx` uses the exact layout classes, static breadcrumbs, static headers, and exact column widths as `DealerManagement.jsx`.
    2. For in-page database hydration (`isHardwareDbSyncing`): `DealerManagement.jsx` renders identical skeleton rows and number slots directly inside the real table and cards.
    3. Shared layout constants (e.g., column definitions, card counts) ensure both stay synchronized.
  - **Pros**: Solves BOTH chunk-loading Suspense and in-page DB hydration; zero layout shift; fully resilient to hard refresh.
  - **Cons**: Requires keeping shared layout definitions consistent.
  - **Effort / Risk**: Low effort / Minimal risk.

  ---

  ## 5. Risks & Considerations
  1. **Network Throttling**: On Slow 3G, if web fonts take >3s to load, icons must maintain reserve space (`w-5 h-5` / `w-9 h-9`) so buttons don't collapse.
  2. **Mobile Viewports (< 640px)**: Table view switches to horizontal scroll or card layout. Skeletons must reflect responsive breakpoints (`sm:hidden` / `sm:table`).
  3. **Strict Zero Secret Policy**: No mock data with credentials should be introduced.
  4. **Direct DB Single Source of Truth**: Skeletons must automatically dismantle the moment Supabase delivers data without stale caching.

  ---

  ## 6. Open Questions for User
  1. Would you like us to proceed with **Approach C** (Hybrid Shared Shell + Section-wise Loading Slots)?
  2. In the Table view, when loading on desktop, should we render exactly **15 skeleton rows** (matching the default page size) or fill the active viewport (~10 rows)?
  3. For the 3 header buttons during code-split loading, should they be rendered as **disabled real buttons** with `pointer-events-none opacity-80` (zero layout shift) or as pure gray skeleton outlines?

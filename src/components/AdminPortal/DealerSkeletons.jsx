import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_PAGE_SIZE,
  ROW_HEIGHT_PX,
  DEALER_VIEW_CONTAINER_CLASSES,
  DealerBreadcrumb,
  DealerHeaderTitle,
  DealerHeaderActions,
  DealerTableHeader,
  DealerPaginationFooter
} from './DealerPageParts';

// 1. Exact Page Header with Real Static Text & Disabled Action Buttons
export function DealerHeaderSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 select-none" data-skel="dealer-header">
      <div>
        <DealerBreadcrumb disabled={true} />
        <DealerHeaderTitle />
      </div>
      <DealerHeaderActions disabled={true} />
    </div>
  );
}

// 2. Exact 4 KPI Stat Cards with Real Labels, Real Icons, and Neutral Skeleton Values
export function DealerStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 select-none" data-skel="dealer-kpi-cards">
      {/* Card 1: Total Registered Dealers */}
      <div className="kpi-card bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[165px]">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-secondary font-label-sm uppercase tracking-wider text-[11px]">Total Registered Dealers</span>
            <span className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-[#0F1B2E]">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>handshake</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <Skeleton className="h-8 w-14 my-0.5 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#F1F4F9] flex items-center justify-between text-body-sm text-secondary">
          <span>Western Grid Region</span>
          <Skeleton className="h-4 w-28 rounded" />
        </div>
      </div>

      {/* Card 2: Active & Quoting */}
      <div className="kpi-card bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[165px]">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-secondary font-label-sm uppercase tracking-wider text-[11px]">Active &amp; Quoting</span>
            <span className="w-9 h-9 rounded-lg bg-[#6CBF3D]/15 flex items-center justify-center text-[#2E7D32]">
              <span className="material-symbols-outlined text-[20px]">bolt</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <Skeleton className="h-8 w-14 my-0.5 rounded-md" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#F1F4F9] flex items-center justify-between text-body-sm text-secondary">
          <span>Cumulative Capacity</span>
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      </div>

      {/* Card 3: Pending Verification / KYC */}
      <div className="kpi-card bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[165px]">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-secondary font-label-sm uppercase tracking-wider text-[11px]">Pending Verification / KYC</span>
            <span className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <Skeleton className="h-8 w-10 my-0.5 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#F1F4F9] flex items-center justify-between text-body-sm text-secondary">
          <span>Avg. review SLA</span>
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      </div>

      {/* Card 4: Suspended / Inactive */}
      <div className="kpi-card bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[165px]">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-secondary font-label-sm uppercase tracking-wider text-[11px]">Suspended / Inactive</span>
            <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <span className="material-symbols-outlined text-[20px]">person_off</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <Skeleton className="h-8 w-10 my-0.5 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#F1F4F9] text-body-sm text-secondary truncate">
          <span>License review or dormant</span>
        </div>
      </div>
    </div>
  );
}

// 3. Exact Search + Filters Bar with Real Placeholders & Select Labels
export function DealerFiltersSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[#E4E7EB] p-4 shadow-[0px_2px_8px_rgba(0,0,0,0.06)] space-y-3 pointer-events-none select-none" data-skel="dealer-filters">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[280px] max-w-md relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-[18px]">filter_list</span>
          <input
            disabled
            className="w-full h-10 pl-9 pr-3 text-body-sm rounded-lg border border-[#E4E7EB] bg-white outline-none"
            placeholder="Search by Dealer, Firm Name, City, or GSTIN..."
            type="text"
            readOnly
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="h-10 px-3 bg-white border border-[#E4E7EB] rounded-lg text-body-sm text-on-surface flex items-center justify-between gap-2">
            <span>All Sales Channels (Company &amp; Field)</span>
            <span className="material-symbols-outlined text-[16px] text-secondary">expand_more</span>
          </div>
          <div className="h-10 px-3 bg-white border border-[#E4E7EB] rounded-lg text-body-sm text-on-surface flex items-center justify-between gap-2">
            <span>Region / DISCOM Circle (All Circles)</span>
            <span className="material-symbols-outlined text-[16px] text-secondary">expand_more</span>
          </div>
          <div className="h-10 px-3 bg-white border border-[#E4E7EB] rounded-lg text-body-sm text-on-surface flex items-center justify-between gap-2">
            <span>Margin Slab Tier (All Tiers)</span>
            <span className="material-symbols-outlined text-[16px] text-secondary">expand_more</span>
          </div>
          <div className="h-10 px-3 bg-white border border-[#E4E7EB] rounded-lg text-body-sm text-on-surface flex items-center justify-between gap-2">
            <span>Category / Model (All)</span>
            <span className="material-symbols-outlined text-[16px] text-secondary">expand_more</span>
          </div>
          <div className="h-10 w-10 rounded-lg text-secondary border border-[#E4E7EB] bg-white text-label-sm flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
          </div>
        </div>
      </div>

      {/* Quick Tabs & View Mode Toggle */}
      <div className="pt-3 border-t border-[#F1F4F9] flex flex-wrap items-center justify-between gap-3 text-label-sm">
        <div className="flex items-center gap-1 bg-[#F6F8F7] p-1 rounded-lg">
          <div className="px-3 py-1.5 rounded-md font-semibold bg-white text-[#0F1B2E] shadow-xs flex items-center gap-1.5">
            <span>All</span>
            <Skeleton className="h-4 w-6 rounded-full" />
          </div>
          <div className="px-3 py-1.5 rounded-md font-medium text-secondary flex items-center gap-1.5">
            <span>Active</span>
            <Skeleton className="h-4 w-6 rounded-full" />
          </div>
          <div className="px-3 py-1.5 rounded-md font-medium text-secondary flex items-center gap-1.5">
            <span>Pending KYC</span>
            <Skeleton className="h-4 w-5 rounded-full" />
          </div>
          <div className="px-3 py-1.5 rounded-md font-medium text-secondary flex items-center gap-1.5">
            <span>Suspended</span>
            <Skeleton className="h-4 w-5 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#F6F8F7] p-1 rounded-lg border border-[#E4E7EB]">
            <span className="px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 text-secondary">
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              <span>Cards</span>
            </span>
            <span className="px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 bg-white text-[#0F1B2E] shadow-xs">
              <span className="material-symbols-outlined text-[16px] text-[#2E7D32]">table_rows</span>
              <span>Table</span>
            </span>
          </div>
          <div className="text-body-sm text-secondary flex items-center gap-1">
            <span>Showing</span>
            <Skeleton className="h-4 w-8 rounded" />
            <span>of</span>
            <Skeleton className="h-4 w-6 rounded" />
            <span>Gujarat Dealers</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 4. Exact 10-Column Dealer Table Rows (Shape-for-Shape, 15 Rows, Height ≈ 92px, 5 Actions)
export function DealerTableSkeletonRows({ rows = DEFAULT_PAGE_SIZE }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr
          key={`dlr-tbl-skel-row-${r}`}
          className="bg-white hover:bg-[#F0F4F2]/50 transition-colors h-[92px] select-none"
          data-skel={`table-row-${r}`}
        >
          {/* 1. Dealer ID */}
          <td className="py-3.5 px-2.5 align-top whitespace-nowrap w-[110px]">
            <Skeleton className="h-6 w-20 rounded font-mono" />
          </td>

          {/* 2. Dealer / Firm Name + Category + Contact */}
          <td className="py-3.5 px-2.5 align-top min-w-[170px]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className={`h-4 ${r % 3 === 0 ? 'w-44' : r % 2 === 0 ? 'w-36' : 'w-40'} rounded`} />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className={`h-3.5 ${r % 2 === 0 ? 'w-28' : 'w-32'} rounded mt-1.5`} />
              <Skeleton className="h-3 w-36 rounded mt-1.5 font-mono" />
            </div>
          </td>

          {/* 3. Region & DISCOM */}
          <td className="py-3.5 px-2.5 align-top w-[125px]">
            <Skeleton className={`h-4 ${r % 2 === 0 ? 'w-28' : 'w-24'} rounded`} />
            <Skeleton className="h-5 w-24 rounded mt-1" />
          </td>

          {/* 4. Assigned Salesman */}
          <td className="py-3.5 px-2.5 align-top w-[130px]">
            <Skeleton className={`h-4 ${r % 2 === 0 ? 'w-32' : 'w-28'} rounded`} />
            <Skeleton className="h-3 w-16 rounded mt-1 font-mono" />
          </td>

          {/* 5. Pricing & Margin */}
          <td className="py-3.5 px-2.5 align-top w-[120px]">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-3 w-28 rounded mt-1.5" />
            <Skeleton className="h-2.5 w-20 rounded mt-1" />
          </td>

          {/* 6. Quotes */}
          <td className="py-3.5 px-2 text-right align-top w-[85px]">
            <div className="flex flex-col items-end">
              <Skeleton className="h-4 w-16 rounded ml-auto" />
              <Skeleton className="h-3 w-10 rounded ml-auto mt-1" />
            </div>
          </td>

          {/* 7. Files */}
          <td className="py-3.5 px-2 text-right align-top w-[85px]">
            <div className="flex flex-col items-end">
              <Skeleton className="h-4 w-16 rounded ml-auto" />
              <Skeleton className="h-3 w-10 rounded ml-auto mt-1" />
            </div>
          </td>

          {/* 8. Capacity Sold */}
          <td className="py-3.5 px-2.5 text-right align-top w-[95px]">
            <div className="flex flex-col items-end">
              <Skeleton className="h-4 w-14 rounded ml-auto" />
              <Skeleton className="h-1.5 w-16 rounded-full ml-auto mt-1.5" />
              <Skeleton className="h-2.5 w-14 rounded ml-auto mt-1" />
            </div>
          </td>

          {/* 9. Status */}
          <td className="py-3.5 px-2 text-center align-top whitespace-nowrap w-[80px]">
            <div className="inline-flex items-center gap-1.5 justify-center">
              <Skeleton className="w-2 h-2 rounded-full" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
          </td>

          {/* 10. Actions (Exact 5 action icons: Tune, Key, Status, Edit, Delete) */}
          <td className="py-4 px-3 text-center align-top whitespace-nowrap w-[90px]">
            <div className="flex items-center justify-center gap-1">
              <Skeleton className="w-7 h-7 rounded" />
              <Skeleton className="w-7 h-7 rounded" />
              <Skeleton className="w-7 h-7 rounded" />
              <Skeleton className="w-7 h-7 rounded" />
              <Skeleton className="w-7 h-7 rounded" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// 5. Standalone Dealer Table Skeleton with Header and Pagination Footer
export function DealerTableSkeleton({ rows = DEFAULT_PAGE_SIZE }) {
  return (
    <div className="bg-white rounded-xl border border-[#E4E7EB] shadow-[0px_2px_8px_rgba(0,0,0,0.06)] overflow-hidden" data-skel="dealer-table">
      <div className="w-full overflow-x-auto xl:overflow-x-visible">
        <table className="w-full text-left border-collapse table-auto">
          <DealerTableHeader />
          <tbody className="divide-y divide-[#E4E7EB] text-body-sm">
            <DealerTableSkeletonRows rows={rows} />
          </tbody>
        </table>
      </div>

      {/* Shared Pagination Footer in Disabled Skeleton Mode */}
      <DealerPaginationFooter
        currentPage={1}
        pageSize={DEFAULT_PAGE_SIZE}
        totalItems={34}
        totalPages={3}
        disabled={true}
      />
    </div>
  );
}

// 6. Dealer Card Grid Skeleton (Matches DealerManagement Cards View)
export function DealerCardGridSkeleton({ count = 6 }) {
  return (
    <div className="p-4 sm:p-5 select-none" data-skel="dealer-card-grid">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={`dlr-card-skel-${i}`}
            className="bg-white border border-[#E4E7EB] rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3"
          >
            {/* Header: ID + Status */}
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-20 rounded font-mono" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            {/* Firm Name + Category */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-5 w-36 rounded" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-3 w-32 rounded font-mono" />
            </div>

            {/* Region & Salesman */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-12 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-14 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>

            {/* Footer Actions (5 actions) */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1">
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 7. Complete Full-Page Dashboard Skeleton (Exact Shape-for-Shape & Zero Layout Shift)
export function DealerDashboardSkeleton({ viewMode = 'table' }) {
  return (
    <div
      className={DEALER_VIEW_CONTAINER_CLASSES}
      aria-busy="true"
      aria-label="Loading Dealer Partner Management"
      data-skel="dealer-dashboard-root"
    >
      {/* 1. Header Bar */}
      <DealerHeaderSkeleton />

      {/* 2. 4 Stat / KPI Metric Cards */}
      <DealerStatsSkeleton />

      {/* 3. Search, Dropdowns, Tabs Filter Bar */}
      <DealerFiltersSkeleton />

      {/* 4. Table or Cards Presentation */}
      {viewMode === 'card' ? (
        <div className="bg-white rounded-xl border border-[#E4E7EB] shadow-[0px_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          <DealerCardGridSkeleton count={6} />
        </div>
      ) : (
        <DealerTableSkeleton rows={DEFAULT_PAGE_SIZE} />
      )}
    </div>
  );
}

export default DealerDashboardSkeleton;

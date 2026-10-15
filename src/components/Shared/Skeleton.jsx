import React from 'react';

// Reusable Base Shimmer Block
export function Shimmer({ className = '' }) {
  return (
    <div
      className={`animate-pulse bg-surface-container-high/60 rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}

// KPI Metric Cards Skeleton (Matches Admin & Dealer top metric grids)
export function KpiCardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`kpi-skel-${i}`}
          className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-5 shadow-sm flex flex-col justify-between min-h-[140px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="w-8 h-8 rounded-lg" />
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <Shimmer className="h-8 w-24" />
              <Shimmer className="h-4 w-20" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container-high flex items-center justify-between">
            <Shimmer className="h-3 w-28" />
            <Shimmer className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Data Table Skeleton (Matches Quotation Feeds, Dealer Lists, Hardware Catalogs)
export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-surface-container-highest bg-surface-container-lowest">
      <div className="p-4 border-b border-surface-container-highest flex items-center justify-between gap-4">
        <Shimmer className="h-6 w-48" />
        <Shimmer className="h-8 w-64 rounded-lg" />
      </div>
      <table className="w-full text-left border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b border-surface-container-highest bg-surface-container-low/40">
            {Array.from({ length: cols }).map((_, c) => (
              <th key={`th-${c}`} className="p-4">
                <Shimmer className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container-highest">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={`tr-${r}`} className="p-4">
              {Array.from({ length: cols }).map((_, c) => (
                <td key={`td-${r}-${c}`} className="p-4">
                  <Shimmer className={`h-4 ${c === 0 ? 'w-28' : c === 1 ? 'w-36' : 'w-20'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-4 border-t border-surface-container-highest flex items-center justify-between">
        <Shimmer className="h-4 w-36" />
        <div className="flex gap-2">
          <Shimmer className="h-8 w-8 rounded-lg" />
          <Shimmer className="h-8 w-8 rounded-lg" />
          <Shimmer className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Form Skeleton (Matches CreateQuotation stepper, settings forms, profile editors)
export function FormSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-highest p-6 space-y-6 max-w-4xl mx-auto">
      <div className="space-y-2 border-b border-surface-container-highest pb-4">
        <Shimmer className="h-6 w-48" />
        <Shimmer className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`field-${i}`} className="space-y-2">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="pt-4 border-t border-surface-container-highest flex justify-end gap-3">
        <Shimmer className="h-11 w-28 rounded-xl" />
        <Shimmer className="h-11 w-36 rounded-xl" />
      </div>
    </div>
  );
}

// Top Performing Dealers / Leaderboard Widget Skeleton
export function LeaderboardSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-3 w-28" />
        </div>
        <Shimmer className="w-7 h-7 rounded-full" />
      </div>
      <div className="divide-y divide-surface-container-highest">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`lead-${i}`} className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shimmer className="w-6 h-6 rounded-full" />
              <div className="space-y-1.5">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-3 w-24" />
              </div>
            </div>
            <div className="space-y-1 text-right">
              <Shimmer className="h-4 w-16 ml-auto" />
              <Shimmer className="h-3 w-12 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Top Glowing Energy Progress Bar (Micro-loader for tab changes and background sync)
export function TopProgressBar({ active = true }) {
  if (!active) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[2.5px] bg-surface-container overflow-hidden pointer-events-none">
      <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 w-full animate-[shimmer_1.4s_infinite_linear] shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
    </div>
  );
}

// Customer File Card Grid Skeleton (Pixel-Perfect 1:1 match with live Customer File Card)
export function CustomerCardSkeleton({ count = 3 }) {
  // Mirrors the real customer file card in StaffManagement (same paddings, rows, 13-chip / 8-col doc grid, footer)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full" aria-busy="true" aria-label="Loading customer files">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`cust-skel-${i}`}
          className="bg-white border border-[#E4E7EB] rounded-xl p-5 flex flex-col justify-between shadow-xs animate-pulse"
        >
          <div>
            {/* Header: ID + Source pill + Finance pill + Status badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <div className="h-4 w-24 bg-slate-200 rounded" />
                  <div className="h-5 w-40 bg-purple-50 border border-purple-200/70 rounded" />
                  <div className="h-5 w-20 bg-emerald-50 border border-emerald-200/70 rounded" />
                </div>
                <div className="h-6 w-36 bg-slate-300/80 rounded mt-1.5" />
              </div>
              <div className="h-6 w-16 bg-amber-50 border border-amber-200 rounded-full shrink-0" />
            </div>

            {/* Info pills: DISCOM / System & Load */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80 space-y-1.5">
                <div className="h-2.5 w-24 bg-slate-200 rounded" />
                <div className="h-4 w-14 bg-slate-300 rounded" />
                <div className="h-3 w-20 bg-slate-200 rounded" />
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80 space-y-1.5">
                <div className="h-2.5 w-20 bg-slate-200 rounded" />
                <div className="h-4 w-24 bg-emerald-200/80 rounded" />
                <div className="h-3 w-14 bg-slate-200 rounded" />
              </div>
            </div>

            {/* Contact / Assigned / Address */}
            <div className="mt-3 space-y-1.5 text-xs">
              {[['call', 'w-28'], ['person', 'w-52'], ['location_on', 'w-40']].map(([icon, w]) => (
                <div key={icon} className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-slate-300">{icon}</span>
                  <div className={`h-3.5 ${w} max-w-full bg-slate-200 rounded`} />
                </div>
              ))}
            </div>

            {/* Documents: label row + 13 chips on an 8-col grid */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-emerald-200">folder_open</span>
                  <div className="h-3 w-28 bg-slate-200 rounded" />
                </span>
                <div className="h-3 w-20 bg-emerald-100 rounded" />
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                {Array.from({ length: 13 }).map((_, idx) => (
                  <div key={idx} className="h-6 rounded border border-slate-200 bg-slate-50" />
                ))}
              </div>
            </div>
          </div>

          {/* Action footer: Timeline / Docs / Status select */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="h-8 w-24 bg-emerald-50 border border-emerald-200 rounded-lg" />
            <div className="h-8 flex-1 min-w-[96px] bg-white border border-[#E4E7EB] rounded-lg" />
            <div className="h-8 w-24 bg-white border border-[#E4E7EB] rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Document Vault Modal Grid Skeleton (Matches 7-tile Document Vault modal)
export function DocumentVaultSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={`vault-doc-skel-${i}`}
          className="p-4 rounded-xl border border-white/10 bg-surface-container-low/50 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shimmer className="w-8 h-8 rounded-lg" />
              <div className="space-y-1">
                <Shimmer className="h-4 w-28 rounded" />
                <Shimmer className="h-3 w-36 rounded" />
              </div>
            </div>
            <Shimmer className="h-5 w-16 rounded-full" />
          </div>
          <Shimmer className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// Dealer Partner Management Table Skeleton Rows (1:1 Match with Dealer Table in DealerManagement)
export function DealerTableSkeletonRows({ rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={`dlr-row-skel-${r}`} className="bg-white border-b border-[#E4E7EB] animate-pulse">
          {/* 1. Dealer ID */}
          <td className="py-3.5 px-2.5 align-top whitespace-nowrap">
            <div className="h-6 w-24 bg-surface-container rounded font-mono" />
          </td>

          {/* 2. Dealer / Firm Name + Category + Contact */}
          <td className="py-3.5 px-2.5 align-top">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`h-4 ${r % 3 === 0 ? 'w-44' : r % 2 === 0 ? 'w-36' : 'w-48'} bg-slate-300/80 rounded`} />
                <div className="h-4 w-18 bg-emerald-50 border border-emerald-200/60 rounded-full" />
              </div>
              <div className={`h-3 ${r % 2 === 0 ? 'w-28' : 'w-32'} bg-slate-200 rounded`} />
              <div className="flex items-center gap-1.5 text-xs">
                <div className="h-3 w-20 bg-slate-200 rounded font-mono" />
                <div className="h-3 w-3 bg-slate-100 rounded-full" />
                <div className="h-3 w-28 bg-slate-200 rounded" />
              </div>
            </div>
          </td>

          {/* 3. Region & DISCOM */}
          <td className="py-3.5 px-2.5 align-top">
            <div className="space-y-1.5">
              <div className={`h-3.5 ${r % 2 === 0 ? 'w-24' : 'w-20'} bg-slate-300/70 rounded`} />
              <div className="h-4 w-20 bg-sky-50 border border-sky-200/60 rounded-full" />
            </div>
          </td>

          {/* 4. Assigned Salesman */}
          <td className="py-3.5 px-2.5 align-top">
            <div className="space-y-1.5">
              <div className={`h-3.5 ${r % 2 === 0 ? 'w-28' : 'w-24'} bg-slate-300/70 rounded`} />
              <div className="h-3 w-14 bg-slate-200 rounded font-mono" />
            </div>
          </td>

          {/* 5. Pricing & Margin */}
          <td className="py-3.5 px-2.5 align-top">
            <div className="space-y-1.5">
              <div className="h-4 w-18 bg-amber-50 border border-amber-200/60 rounded-full" />
              <div className="h-3 w-20 bg-slate-200 rounded font-mono" />
            </div>
          </td>

          {/* 6. Quotes */}
          <td className="py-3.5 px-2 align-top text-right">
            <div className="flex flex-col items-end gap-1">
              <div className="h-4 w-12 bg-slate-300/70 rounded" />
              <div className="h-3 w-10 bg-emerald-50 border border-emerald-200/50 rounded" />
            </div>
          </td>

          {/* 7. Files */}
          <td className="py-3.5 px-2 align-top text-right">
            <div className="flex flex-col items-end gap-1">
              <div className="h-4 w-10 bg-slate-300/70 rounded" />
              <div className="h-3 w-10 bg-emerald-50 border border-emerald-200/50 rounded" />
            </div>
          </td>

          {/* 8. Capacity Sold */}
          <td className="py-3.5 px-2.5 align-top text-right">
            <div className="flex flex-col items-end gap-1">
              <div className="h-4 w-12 bg-slate-300/80 rounded" />
              <div className="h-3 w-16 bg-slate-200 rounded" />
            </div>
          </td>

          {/* 9. Status */}
          <td className="py-3.5 px-2 align-top text-center">
            <div className="h-5 w-14 bg-emerald-50 border border-emerald-200/60 rounded-full mx-auto" />
          </td>

          {/* 10. Actions */}
          <td className="py-3.5 px-2 align-top text-center">
            <div className="flex items-center justify-center gap-1">
              <div className="h-6 w-6 rounded border border-slate-200 bg-slate-50" />
              <div className="h-6 w-6 rounded border border-slate-200 bg-slate-50" />
              <div className="h-6 w-6 rounded border border-slate-200 bg-slate-50" />
              <div className="h-6 w-6 rounded border border-red-200 bg-red-50/50" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// Standalone Dealer Table Skeleton
export function DealerTableSkeleton({ rows = 8 }) {
  return (
    <div className="w-full overflow-x-auto xl:overflow-x-visible">
      <table className="w-full text-left border-collapse table-auto">
        <thead>
          <tr className="bg-[#0F1B2E] text-white text-label-xs uppercase tracking-wider h-11 select-none">
            <th className="py-3 px-2.5 font-semibold text-left whitespace-nowrap w-[110px]">Dealer ID</th>
            <th className="py-3 px-2.5 font-semibold text-left min-w-[170px]">Dealer / Firm Name</th>
            <th className="py-3 px-2.5 font-semibold text-left w-[125px]">Region &amp; DISCOM</th>
            <th className="py-3 px-2.5 font-semibold text-left w-[130px]">Assigned Salesman</th>
            <th className="py-3 px-2.5 font-semibold text-left w-[120px]">Pricing &amp; Margin</th>
            <th className="py-3 px-2 font-semibold text-right w-[85px]">Quotes</th>
            <th className="py-3 px-2 font-semibold text-right w-[85px]">Files</th>
            <th className="py-3 px-2.5 font-semibold text-right w-[95px]">Capacity Sold</th>
            <th className="py-3 px-2 font-semibold text-center w-[80px]">Status</th>
            <th className="py-3 px-2 font-semibold text-center w-[90px]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E4E7EB] text-body-sm">
          <DealerTableSkeletonRows rows={rows} />
        </tbody>
      </table>
    </div>
  );
}

// Dealer Card View Grid Skeleton (Matches DealerManagement Cards View)
export function DealerCardSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading dealers">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`dlr-card-skel-${i}`}
          className="bg-white border border-[#E4E7EB] rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3 animate-pulse"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="h-5 w-24 bg-surface-container rounded font-mono" />
            <div className="h-5 w-16 bg-emerald-50 border border-emerald-200/50 rounded-full" />
          </div>

          {/* Firm + Category */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="h-5 w-36 bg-slate-300/80 rounded" />
              <div className="h-4 w-16 bg-emerald-50 border border-emerald-200/50 rounded-full" />
            </div>
            <div className="h-3.5 w-24 bg-slate-200 rounded" />
            <div className="h-3 w-28 bg-slate-200 rounded font-mono" />
          </div>

          {/* Region & Salesman */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <div className="h-2.5 w-12 bg-slate-200 rounded" />
              <div className="h-4 w-20 bg-sky-50 border border-sky-200/60 rounded" />
            </div>
            <div className="space-y-1">
              <div className="h-2.5 w-14 bg-slate-200 rounded" />
              <div className="h-4 w-24 bg-slate-200 rounded" />
            </div>
          </div>

          {/* Metrics Row */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="h-4 w-16 bg-amber-50 border border-amber-200/60 rounded" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
            <div className="h-4 w-14 bg-slate-200 rounded" />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
            <div className="h-7 w-12 bg-slate-100 rounded border border-slate-200" />
            <div className="h-7 w-16 bg-slate-100 rounded border border-slate-200" />
            <div className="h-7 w-7 bg-slate-100 rounded border border-slate-200" />
            <div className="h-7 w-7 bg-red-50 rounded border border-red-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Full Dealer Partner Management Page Skeleton (1:1 with Screenshot & Live Layout)
export function DealerManagementSkeleton() {
  return (
    <div className="space-y-6 w-full animate-pulse" aria-busy="true" aria-label="Loading Dealer Partner Management">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs mb-1">
            <div className="h-3 w-20 bg-slate-300/70 rounded" />
            <div className="h-3 w-3 bg-slate-300/70 rounded" />
            <div className="h-3 w-24 bg-slate-300/70 rounded" />
            <div className="h-3 w-3 bg-slate-300/70 rounded" />
            <div className="h-3 w-36 bg-slate-400/80 rounded" />
          </div>
          <div className="h-7 w-64 bg-slate-400/80 rounded-lg mt-1" />
          <div className="h-4 w-96 max-w-full bg-slate-300/70 rounded mt-1.5" />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <div className="h-10 w-40 bg-white border border-[#E4E7EB] rounded-lg shadow-xs" />
          <div className="h-10 w-32 bg-white border border-[#0F1B2E]/30 rounded-lg shadow-xs" />
          <div className="h-10 w-40 bg-[#6CBF3D]/80 rounded-lg shadow-sm" />
        </div>
      </div>

      {/* 4 KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Card 1: Total Registered */}
        <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm flex flex-col justify-between h-[142px]">
          <div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-36 bg-slate-300/70 rounded" />
              <div className="w-9 h-9 rounded-lg bg-surface-container" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="h-7 w-12 bg-slate-400/80 rounded" />
              <div className="h-5 w-24 bg-[#6CBF3D]/20 rounded-full" />
            </div>
          </div>
          <div className="pt-3 border-t border-[#F1F4F9] flex items-center justify-between">
            <div className="h-3 w-28 bg-slate-300/60 rounded" />
            <div className="h-3 w-24 bg-slate-300/80 rounded" />
          </div>
        </div>

        {/* Card 2: Active & Quoting */}
        <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm flex flex-col justify-between h-[142px]">
          <div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-32 bg-slate-300/70 rounded" />
              <div className="w-9 h-9 rounded-lg bg-[#6CBF3D]/20" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="h-7 w-12 bg-slate-400/80 rounded" />
              <div className="h-4 w-28 bg-slate-300/60 rounded" />
              <div className="ml-auto h-4 w-12 bg-[#6CBF3D]/20 rounded" />
            </div>
          </div>
          <div className="pt-3 border-t border-[#F1F4F9] flex items-center justify-between">
            <div className="h-3 w-28 bg-slate-300/60 rounded" />
            <div className="h-3 w-16 bg-[#6CBF3D]/30 rounded" />
          </div>
        </div>

        {/* Card 3: Pending Verification / KYC */}
        <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm flex flex-col justify-between h-[142px]">
          <div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-40 bg-slate-300/70 rounded" />
              <div className="w-9 h-9 rounded-lg bg-amber-500/15" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="h-7 w-8 bg-slate-400/80 rounded" />
              <div className="h-5 w-24 bg-amber-500/20 rounded-full" />
            </div>
          </div>
          <div className="pt-3 border-t border-[#F1F4F9] flex items-center justify-between">
            <div className="h-3 w-24 bg-slate-300/60 rounded" />
            <div className="h-3 w-16 bg-slate-300/80 rounded" />
          </div>
        </div>

        {/* Card 4: Suspended / Inactive */}
        <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm flex flex-col justify-between h-[142px]">
          <div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-36 bg-slate-300/70 rounded" />
              <div className="w-9 h-9 rounded-lg bg-slate-100" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="h-7 w-8 bg-slate-400/80 rounded" />
              <div className="h-5 w-14 bg-surface-container rounded-full" />
            </div>
          </div>
          <div className="pt-3 border-t border-[#F1F4F9]">
            <div className="h-3 w-36 bg-slate-300/60 rounded" />
          </div>
        </div>
      </div>

      {/* FILTER & CONTROL BAR */}
      <div className="bg-white rounded-xl border border-[#E4E7EB] p-4 shadow-[0px_2px_8px_rgba(0,0,0,0.06)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[280px] max-w-md h-10 bg-slate-50 border border-[#E4E7EB] rounded-lg" />
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="h-10 w-56 bg-slate-50 border border-[#E4E7EB] rounded-lg" />
            <div className="h-10 w-52 bg-slate-50 border border-[#E4E7EB] rounded-lg" />
            <div className="h-10 w-44 bg-slate-50 border border-[#E4E7EB] rounded-lg" />
            <div className="h-10 w-40 bg-slate-50 border border-[#E4E7EB] rounded-lg" />
            <div className="h-10 w-10 bg-slate-50 border border-[#E4E7EB] rounded-lg" />
          </div>
        </div>

        {/* Quick Tabs & View Mode */}
        <div className="pt-3 border-t border-[#F1F4F9] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-[#F6F8F7] p-1 rounded-lg">
            <div className="h-7 w-16 bg-white rounded shadow-xs" />
            <div className="h-7 w-20 bg-transparent rounded" />
            <div className="h-7 w-24 bg-transparent rounded" />
            <div className="h-7 w-24 bg-transparent rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 bg-slate-50 border border-[#E4E7EB] rounded-lg" />
            <div className="h-4 w-44 bg-slate-300/60 rounded" />
          </div>
        </div>
      </div>

      {/* TABLE DATA SKELETON */}
      <div className="bg-white rounded-xl border border-[#E4E7EB] shadow-[0px_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
        <DealerTableSkeleton rows={8} />
      </div>
    </div>
  );
}

export { DealerDashboardSkeleton as DealerDashboardSkeletonMaster } from '../AdminPortal/DealerSkeletons';
export {
  DealerHeaderSkeleton,
  DealerStatsSkeleton,
  DealerFiltersSkeleton,
  DealerCardGridSkeleton,
  DealerDashboardSkeleton
} from '../AdminPortal/DealerSkeletons';




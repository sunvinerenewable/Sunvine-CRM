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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`cust-skel-${i}`}
          className="bg-white border border-[#E4E7EB] rounded-xl p-5 flex flex-col justify-between shadow-xs animate-pulse"
        >
          <div>
            {/* Top Row: Ref ID + Source Pill + Payment Pill + Status Badge */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <div className="h-4 w-16 bg-slate-200/80 rounded text-[11px] font-mono" />
                  <div className="h-4 w-24 bg-purple-50 border border-purple-200/70 rounded" />
                  <div className="h-4 w-16 bg-emerald-50 border border-emerald-200/70 rounded" />
                </div>
                {/* Customer Title */}
                <div className="h-5 w-32 bg-slate-300/80 rounded mt-1.5" />
              </div>
              <div className="h-5 w-16 bg-amber-50 border border-amber-200 rounded-full" />
            </div>

            {/* 2-Column Specs Box: DISCOM / Load */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80 space-y-1">
                <span className="text-slate-400 block text-[10px] font-medium">DISCOM / Consumer No</span>
                <div className="h-3.5 w-14 bg-slate-300 rounded" />
                <div className="h-3 w-20 bg-slate-200 rounded" />
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80 space-y-1">
                <span className="text-slate-400 block text-[10px] font-medium">System &amp; Load</span>
                <div className="h-3.5 w-20 bg-emerald-200/80 rounded" />
                <div className="h-3 w-16 bg-slate-200 rounded" />
              </div>
            </div>

            {/* Contact & Sales Executive Meta */}
            <div className="mt-3 space-y-1.5 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-slate-400">call</span>
                <div className="h-3.5 w-24 bg-slate-200 rounded" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-slate-400">person</span>
                <div className="h-3.5 w-36 bg-slate-200 rounded" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-slate-400">location_on</span>
                <div className="h-3.5 w-40 bg-slate-200 rounded" />
              </div>
            </div>

            {/* Document Badges (Dynamic 7-Chip Strip) */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600">folder_open</span>
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                </span>
                <div className="h-3 w-16 bg-emerald-100 rounded" />
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 text-center">
                {['Aadhaar', 'Bank', 'Light', 'PAN', 'Vera', 'Pre-Inst.', 'Co-App.'].map((label, idx) => (
                  <div
                    key={idx}
                    className="py-1 px-1 rounded flex flex-col items-center justify-center text-[9px] border border-slate-200 bg-slate-50 text-slate-400"
                  >
                    <span className="truncate w-full">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="py-1.5 px-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[15px]">timeline</span>
              <span>Timeline</span>
            </div>
            <div className="flex-1 py-1.5 px-3 bg-white border border-[#E4E7EB] text-slate-600 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-emerald-600">upload_file</span>
              <span>Docs (Optional)</span>
            </div>
            <div className="h-7 w-20 bg-slate-100 border border-slate-200 rounded-lg" />
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


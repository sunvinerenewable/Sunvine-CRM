import React from 'react';

export function ProposalSkeleton() {
  return (
    <div className="min-h-screen bg-[#F6F8F7] text-[#0F1B2E] font-sans antialiased py-4 px-3 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Top Floating Actions Bar Skeleton */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-8 w-28 bg-emerald-600/20 rounded-lg"></div>
            <div className="h-5 w-32 bg-slate-200 rounded"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-[#25D366]/20 rounded-xl"></div>
            <div className="h-9 w-24 bg-slate-200 rounded-xl"></div>
          </div>
        </div>

        {/* A4 Document Skeleton */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-10 space-y-8 animate-pulse">
          {/* Proposal Header Banner */}
          <div className="border-b border-slate-100 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2.5">
              <div className="h-7 w-56 bg-slate-300 rounded-lg"></div>
              <div className="h-4 w-40 bg-slate-200 rounded"></div>
            </div>
            <div className="h-10 w-36 bg-emerald-100 rounded-xl"></div>
          </div>

          {/* Customer & Project Info Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/80 rounded-xl p-4 border border-slate-100">
            <div className="space-y-2">
              <div className="h-3 w-20 bg-slate-300 rounded"></div>
              <div className="h-5 w-36 bg-slate-200 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 bg-slate-300 rounded"></div>
              <div className="h-5 w-28 bg-slate-200 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 bg-slate-300 rounded"></div>
              <div className="h-5 w-32 bg-slate-200 rounded"></div>
            </div>
          </div>

          {/* System Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                <div className="h-3 w-16 bg-slate-300 rounded"></div>
                <div className="h-6 w-20 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>

          {/* Bill of Materials Table Skeleton */}
          <div className="space-y-3 pt-2">
            <div className="h-4 w-44 bg-slate-300 rounded"></div>
            <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
              <div className="h-10 bg-slate-100/70"></div>
              <div className="h-12 bg-white"></div>
              <div className="h-12 bg-slate-50/30"></div>
              <div className="h-12 bg-white"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortalSkeleton() {
  const sidebarItems = [
    { label: 'Executive Overview', icon: 'dashboard', active: true },
    { label: 'Business Performance', icon: 'monitoring' },
    { label: 'Dealer Partners', icon: 'group' },
    { label: 'Sales Team & Files', icon: 'badge' },
    { label: 'Reports & Export', icon: 'download' },
    { label: 'Audit Logs Trail', icon: 'receipt_long' },
    { label: 'Lead Generation', icon: 'radar' },
    { label: 'New Direct Quote', icon: 'note_add' },
    { label: 'Pricing & Presets', icon: 'tune' },
    { label: 'Hardware Catalog', icon: 'memory' },
    { label: 'All Quotations', icon: 'inventory_2' },
    { label: 'Documentation Hub', icon: 'description' },
    { label: 'Master Governance', icon: 'settings' },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8F7] text-[#0F1B2E] font-sans antialiased">
      {/* Desktop Left Sidebar Skeleton */}
      <aside className="no-print hidden md:flex fixed left-0 top-0 h-screen w-64 bg-on-secondary-fixed z-50 flex-col justify-between select-none">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Brand Header */}
          <div className="h-16 px-6 flex items-center gap-2 border-b border-white/10 shrink-0">
            <img
              alt="Sunvine Renewable Energy Logo"
              className="h-8 w-auto object-contain"
              src="/sunvine_logo_white.png"
            />
            <span className="font-label-xs text-[10px] text-secondary-fixed-dim tracking-wider uppercase font-semibold">
              Portal
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col mt-2 flex-1 overflow-y-auto py-1">
            {sidebarItems.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-6 py-2.5 text-left ${
                  item.active
                    ? 'border-l-4 border-primary-container bg-white/10 text-on-secondary font-label-md'
                    : 'text-secondary-fixed-dim hover:bg-white/5 hover:text-on-secondary font-body-md'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] opacity-80">{item.icon}</span>
                <span className="text-xs truncate">{item.label}</span>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Desktop Top Header Skeleton */}
      <header className="no-print hidden md:flex fixed top-0 left-64 right-0 h-16 bg-surface-container-lowest border-b border-surface-container-high z-40 items-center justify-between px-4 sm:px-6 xl:px-8 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 text-secondary font-label-sm">
          <span className="material-symbols-outlined text-[18px] text-primary">solar_power</span>
          <span className="text-xs font-medium text-on-surface">Dealer Operations</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl text-secondary">
            <span className="material-symbols-outlined text-[22px]">notifications</span>
          </div>
          <div className="flex items-center gap-2.5 pl-3 border-l border-surface-container-high">
            <div className="w-8 h-8 rounded-full bg-slate-200"></div>
            <div className="hidden sm:block space-y-0.5">
              <div className="h-3.5 w-20 bg-slate-300 rounded"></div>
              <div className="h-2.5 w-24 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area Skeleton */}
      <main className="md:pl-64 pt-16 pb-24 md:pb-8 w-full min-w-0 max-w-full">
        <div className="p-3 sm:p-4 lg:p-6 xl:p-8 w-full max-w-[1600px] mx-auto min-w-0">
          <ViewSkeleton />
        </div>
      </main>
    </div>
  );
}

export default function ViewSkeleton({ title = 'Loading portal view...' }) {
  return (
    <div className="flex flex-col gap-8 w-full max-w-full overflow-x-hidden animate-pulse">
      {/* 1. Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="h-8 w-72 bg-surface-container-highest rounded-lg"></div>
            <div className="h-6 w-28 bg-primary-container/20 rounded-full"></div>
          </div>
          <div className="h-4 w-80 sm:w-96 bg-surface-container-high rounded mt-1.5"></div>
        </div>

        {/* Action Controls: Date Range, Export Ledger, New Direct Quote */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="h-9 w-44 bg-surface-container-lowest border border-surface-container-highest rounded-lg shadow-xs"></div>
          <div className="h-9 w-32 bg-surface-container-lowest border border-surface-container-highest rounded-lg shadow-xs"></div>
          <div className="h-9 w-36 bg-primary/90 rounded-lg shadow-sm"></div>
        </div>
      </div>

      {/* 2. Top 4 KPI Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {[
          { titleWidth: 'w-36', valueWidth: 'w-10', badgeWidth: 'w-14', sub1Width: 'w-36', sub2Width: 'w-16' },
          { titleWidth: 'w-32', valueWidth: 'w-10', badgeWidth: 'w-24', sub1Width: 'w-32', sub2Width: 'w-20' },
          { titleWidth: 'w-40', valueWidth: 'w-20', badgeWidth: 'w-24', sub1Width: 'w-36', sub2Width: 'w-16' },
          { titleWidth: 'w-44', valueWidth: 'w-8', badgeWidth: 'w-16', sub1Width: 'w-32', sub2Width: 'w-20' },
        ].map((card, idx) => (
          <div key={idx} className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-5 shadow-sm flex flex-col justify-between h-[152px]">
            <div>
              <div className="flex items-center justify-between">
                <div className={`h-3.5 ${card.titleWidth} bg-surface-container-high rounded`}></div>
                <div className="w-8 h-8 rounded-lg bg-surface-container"></div>
              </div>
              <div className="mt-3 flex items-baseline gap-3">
                <div className={`h-7 ${card.valueWidth} bg-surface-container-highest rounded-lg`}></div>
                <div className={`h-5 ${card.badgeWidth} bg-primary-container/15 rounded-full`}></div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container-high flex items-center justify-between">
              <div className={`h-3 ${card.sub1Width} bg-surface-container-high rounded`}></div>
              <div className={`h-3 ${card.sub2Width} bg-surface-container-high rounded`}></div>
            </div>
          </div>
        ))}
      </section>

      {/* 3. Middle 2-Column Section (Presets & Top Dealers) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Widget 1: Quotation Presets */}
        <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-5 shadow-sm flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-primary/20"></div>
                <div className="h-6 w-36 bg-surface-container-highest rounded-lg"></div>
              </div>
              <div className="h-5 w-24 bg-primary-container/20 rounded-full"></div>
            </div>

            <div className="flex flex-col gap-3 py-2 border-y border-surface-container-highest">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-36 bg-surface-container-high rounded"></div>
                <div className="h-4 w-28 bg-surface-container-highest rounded"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-36 bg-surface-container-high rounded"></div>
                <div className="h-4 w-32 bg-primary/20 rounded"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-36 bg-surface-container-high rounded"></div>
                <div className="h-4 w-28 bg-surface-container-highest rounded"></div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="h-3 w-20 bg-surface-container-high rounded"></div>
                <div className="h-3 w-32 bg-surface-container-high rounded"></div>
              </div>
            </div>
          </div>

          <div className="h-10 w-full rounded-lg border border-on-surface/20 bg-surface-container-low"></div>
        </div>

        {/* Widget 2: Top Performing Dealers Leaderboard */}
        <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-5 shadow-sm flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-6 w-44 bg-surface-container-highest rounded-lg"></div>
                <div className="h-3 w-44 bg-surface-container-high rounded mt-1"></div>
              </div>
              <div className="w-7 h-7 rounded-full bg-primary-container/20"></div>
            </div>

            <div className="flex flex-col divide-y divide-surface-container-highest">
              {[
                { nameW: 'w-32', subW: 'w-36', revW: 'w-16', winW: 'w-20', isTop: true },
                { nameW: 'w-36', subW: 'w-40', revW: 'w-16', winW: 'w-20', isTop: false },
                { nameW: 'w-28', subW: 'w-32', revW: 'w-16', winW: 'w-20', isTop: false },
                { nameW: 'w-32', subW: 'w-36', revW: 'w-16', winW: 'w-20', isTop: false },
              ].map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                      item.isTop ? 'bg-primary-container/40' : 'bg-surface-container-high'
                    }`}></div>
                    <div className="space-y-1">
                      <div className={`h-3.5 ${item.nameW} bg-surface-container-highest rounded`}></div>
                      <div className={`h-2.5 ${item.subW} bg-surface-container-high rounded`}></div>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className={`h-4 ${item.revW} bg-surface-container-highest rounded ml-auto`}></div>
                    <div className={`h-2.5 ${item.winW} bg-primary/20 rounded ml-auto`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <div className="h-4 w-44 bg-primary/20 rounded"></div>
          </div>
        </div>
      </div>

      {/* 4. Dealer Quotation Feed & Audit Activity */}
      <section className="flex flex-col gap-4 w-full min-w-0 max-w-full">
        <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm overflow-hidden">
          {/* Header Controls */}
          <div className="p-4 sm:p-5 border-b border-surface-container-highest flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="h-6 w-72 bg-surface-container-highest rounded-lg"></div>
                <div className="h-3.5 w-80 bg-surface-container-high rounded mt-1.5"></div>
              </div>
              <div className="h-8 w-24 bg-surface-container-low rounded-lg border border-surface-container-highest"></div>
            </div>

            {/* Filter Status Pills */}
            <div className="flex items-center bg-surface-container-low p-1 rounded-lg border border-surface-container-highest gap-1 overflow-x-auto">
              <div className="h-7 w-16 bg-surface-container-lowest rounded shadow-xs"></div>
              <div className="h-7 w-20 bg-transparent rounded"></div>
              <div className="h-7 w-24 bg-transparent rounded"></div>
              <div className="h-7 w-28 bg-transparent rounded"></div>
            </div>
          </div>

          {/* Table / Feed Placeholder Rows */}
          <div className="divide-y divide-surface-container-highest/60">
            {[1, 2, 3].map(row => (
              <div key={row} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-surface-container"></div>
                  <div className="space-y-1.5">
                    <div className="h-4 w-40 bg-surface-container-highest rounded"></div>
                    <div className="h-3 w-56 bg-surface-container-high rounded"></div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-5 w-20 bg-primary-container/20 rounded-full"></div>
                  <div className="h-4 w-24 bg-surface-container-highest rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

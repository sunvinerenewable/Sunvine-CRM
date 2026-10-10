import React from 'react';

// Shared Constants across Real Dashboard & Skeletons
export const DEFAULT_PAGE_SIZE = 15;
export const ROW_HEIGHT_PX = 92;
export const DEALER_VIEW_CONTAINER_CLASSES = "flex flex-col gap-6 w-full pb-16";

export const DEALER_TABLE_COLUMNS = [
  { id: 'id', label: 'Dealer ID', widthClass: 'w-[110px]', align: 'text-left', nowrap: true },
  { id: 'firm', label: 'Dealer / Firm Name', widthClass: 'min-w-[170px]', align: 'text-left' },
  { id: 'region', label: 'Region & DISCOM', widthClass: 'w-[125px]', align: 'text-left' },
  { id: 'salesman', label: 'Assigned Salesman', widthClass: 'w-[130px]', align: 'text-left' },
  { id: 'pricing', label: 'Pricing & Margin', widthClass: 'w-[120px]', align: 'text-left' },
  { id: 'quotes', label: 'Quotes', widthClass: 'w-[85px]', align: 'text-right' },
  { id: 'files', label: 'Files', widthClass: 'w-[85px]', align: 'text-right' },
  { id: 'capacity', label: 'Capacity Sold', widthClass: 'w-[95px]', align: 'text-right' },
  { id: 'status', label: 'Status', widthClass: 'w-[80px]', align: 'text-center' },
  { id: 'actions', label: 'Actions', widthClass: 'w-[90px]', align: 'text-center' }
];

// 1. Shared Breadcrumb Navigation
export function DealerBreadcrumb({ onNavigateConsole, onNavigateDirectory, disabled = false }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs font-label-xs text-secondary mb-2 select-none" aria-label="Breadcrumb">
      {disabled || !onNavigateConsole ? (
        <span className="flex items-center gap-1 text-secondary">
          <span className="material-symbols-outlined text-[14px]">dashboard</span>
          <span>Admin Console</span>
        </span>
      ) : (
        <button
          onClick={onNavigateConsole}
          className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">dashboard</span>
          <span>Admin Console</span>
        </button>
      )}

      <span className="material-symbols-outlined text-xs text-secondary">chevron_right</span>

      {disabled || !onNavigateDirectory ? (
        <span className="text-secondary">Partner Directory</span>
      ) : (
        <button
          onClick={onNavigateDirectory}
          className="hover:text-primary transition-colors cursor-pointer"
          type="button"
        >
          Partner Directory
        </button>
      )}

      <span className="material-symbols-outlined text-xs text-secondary">chevron_right</span>
      <span className="text-on-surface font-semibold">Dealer Partner Management</span>
    </nav>
  );
}

// 2. Shared Page Title & Subtitle Header
export function DealerHeaderTitle() {
  return (
    <div>
      <h1 className="font-poppins font-bold text-headline-xl text-[#0F1B2E] tracking-tight">
        Dealer Partner Management
      </h1>
      <p className="text-body-md text-secondary mt-1">
        Manage onboarded EPC dealers, commission tiers, login credentials, and quotation permissions.
      </p>
    </div>
  );
}

// 3. Shared 3 Top Action Buttons (Active or Disabled/Skeleton Mode)
export function DealerHeaderActions({
  onConfigureMargins,
  onExportDirectory,
  onOnboardDealer,
  disabled = false
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 ${disabled ? 'pointer-events-none select-none' : ''}`}>
      <button
        onClick={onConfigureMargins}
        disabled={disabled}
        aria-disabled={disabled}
        className="h-10 px-3.5 sm:px-4 bg-white border border-[#E4E7EB] hover:border-primary text-on-surface font-label-md rounded-lg hover:bg-surface-container-low transition-all duration-150 flex items-center gap-2 shadow-xs text-xs sm:text-sm cursor-pointer disabled:cursor-not-allowed"
        type="button"
      >
        <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
        <span>Configure Tier Margins</span>
      </button>

      <button
        onClick={onExportDirectory}
        disabled={disabled}
        aria-disabled={disabled}
        className="h-10 px-3.5 sm:px-4 bg-white border border-[#0F1B2E] text-[#0F1B2E] font-label-md rounded-lg hover:bg-[#F6F8F7] transition-all duration-150 flex items-center gap-2 shadow-xs text-xs sm:text-sm cursor-pointer disabled:cursor-not-allowed"
        type="button"
        title="Export Gujarat dealer directory as CSV"
      >
        <span className="material-symbols-outlined text-[18px]">download</span>
        <span>Export Directory</span>
      </button>

      <button
        onClick={onOnboardDealer}
        disabled={disabled}
        aria-disabled={disabled}
        className="h-10 px-3.5 sm:px-4 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-label-md font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 shadow-sm focus:ring-2 focus:ring-primary-container focus:ring-offset-2 text-xs sm:text-sm cursor-pointer disabled:cursor-not-allowed"
        type="button"
      >
        <span className="material-symbols-outlined text-[20px]">person_add</span>
        <span>+ Onboard New Dealer</span>
      </button>
    </div>
  );
}

// 4. Shared 10-Column Table Header
export function DealerTableHeader() {
  return (
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
  );
}

// 5. Shared Table Pagination Footer (Active or Disabled/Skeleton Mode)
export function DealerPaginationFooter({
  currentPage = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  totalItems = 34,
  totalPages = 3,
  onPrevPage,
  onNextPage,
  onSelectPage,
  disabled = false
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={`p-4 border-t border-[#E4E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-secondary font-label-sm text-label-sm ${disabled ? 'pointer-events-none select-none' : ''}`}>
      <span>
        Showing <span className="font-semibold text-on-surface">{startItem} to {endItem}</span> of <span className="font-semibold text-on-surface">{totalItems}</span> Gujarat entries
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={onPrevPage}
          disabled={disabled || currentPage === 1}
          aria-disabled={disabled || currentPage === 1}
          className="p-1.5 rounded border border-[#E4E7EB] text-secondary hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          type="button"
          aria-label="Previous page"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>

        {Array.from({ length: Math.min(5, Math.max(1, totalPages)) }, (_, i) => {
          let pageNum = i + 1;
          if (totalPages > 5 && currentPage > 3) {
            pageNum = currentPage - 2 + i;
            if (pageNum > totalPages) pageNum = totalPages - (4 - i);
          }
          const isActive = currentPage === pageNum;
          return (
            <button
              key={pageNum}
              onClick={() => onSelectPage && onSelectPage(pageNum)}
              disabled={disabled}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                isActive ? 'bg-[#0F1B2E] text-white' : 'hover:bg-surface-container text-on-surface bg-white border border-[#E4E7EB]'
              }`}
              type="button"
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={onNextPage}
          disabled={disabled || currentPage >= totalPages}
          aria-disabled={disabled || currentPage >= totalPages}
          className="p-1.5 rounded border border-[#E4E7EB] text-secondary hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          type="button"
          aria-label="Next page"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}

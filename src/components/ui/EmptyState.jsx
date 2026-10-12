import React from 'react';
import Button from './Button';

/**
 * Enterprise Sunvine Empty State Component
 * Reusable placeholder across lists, tables, search results, and filters.
 */

export function EmptyState({
  icon = 'inbox',
  title = 'No records found',
  description = 'There are no items to display at this time.',
  actionLabel = null,
  onAction = null,
  actionIcon = null,
  className = ''
}) {
  return (
    <div
      className={`
        w-full p-8 sm:p-12 rounded-2xl border border-dashed border-slate-800/80 bg-[#0D1527]/50
        flex flex-col items-center justify-center text-center
        ${className}
      `}
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-750 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
        <span className="material-symbols-outlined text-[2rem] leading-none text-emerald-400/80" aria-hidden="true">
          {icon}
        </span>
      </div>

      <h4 className="text-base sm:text-lg font-bold text-slate-200 tracking-tight">
        {title}
      </h4>

      {description && (
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm mt-1.5 leading-relaxed">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <div className="mt-6">
          <Button
            variant="primary"
            size="md"
            icon={actionIcon}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export default EmptyState;

import React from 'react';
import Button from './Button';

/**
 * Enterprise Sunvine Empty State Component
 * Rule 6: UI/UX Pro Max Protocol — WCAG 4.5:1 contrast compliant.
 * Solid dark console background with high-contrast text.
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
        w-full p-6 sm:p-10 rounded-2xl border-2 border-dashed border-slate-700 bg-[#0D1527] shadow-2xl
        flex flex-col items-center justify-center text-center
        ${className}
      `}
    >
      {/* Icon Pill */}
      <div className="w-14 h-14 rounded-2xl bg-[#15233E] border border-slate-700 flex items-center justify-center mb-4 shadow-lg shadow-black/40">
        <span className="material-symbols-outlined text-[2.25rem] leading-none text-emerald-400" aria-hidden="true">
          {icon}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
        {title}
      </h4>

      {/* Description */}
      {description && (
        <p className="text-sm text-slate-300 max-w-md mt-2 leading-relaxed font-normal">
          {description}
        </p>
      )}

      {/* Action Button */}
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button
            variant="primary"
            size="md"
            icon={actionIcon}
            onClick={onAction}
            className="shadow-lg shadow-emerald-950/60 font-bold"
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export default EmptyState;

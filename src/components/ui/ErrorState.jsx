import React from 'react';
import Button from './Button';

/**
 * Enterprise Sunvine Error State Component
 * Rule 6: UI/UX Pro Max Protocol — WCAG 4.5:1 contrast compliant.
 * Uses solid high-contrast backgrounds so text is never washed out.
 */

export function ErrorState({
  icon = 'error',
  title = 'Something went wrong',
  description = 'An error occurred while loading this data. Please try again.',
  error = null,
  onRetry = null,
  retryLabel = 'Retry Connection',
  className = ''
}) {
  return (
    <div
      className={`
        w-full p-6 sm:p-10 rounded-2xl border-2 border-rose-500/40 bg-[#1A0B12] shadow-2xl
        flex flex-col items-center justify-center text-center
        ${className}
      `}
      role="alert"
    >
      {/* Icon Pill */}
      <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border-2 border-rose-500/50 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-950/50">
        <span className="material-symbols-outlined text-[2.25rem] leading-none text-rose-400" aria-hidden="true">
          {icon}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
        {title}
      </h4>

      {/* Description */}
      {description && (
        <p className="text-sm text-rose-100/90 max-w-md mt-2 leading-relaxed font-normal">
          {description}
        </p>
      )}

      {/* Technical Error Code Badge */}
      {error && (
        <div className="mt-4 px-3.5 py-2 rounded-xl bg-black/80 border border-rose-500/40 text-rose-300 font-mono text-xs max-w-md break-all font-semibold shadow-inner">
          {typeof error === 'string' ? error : error?.message || 'Unknown error details'}
        </div>
      )}

      {/* Retry Action Button */}
      {onRetry && (
        <div className="mt-6">
          <Button
            variant="danger"
            size="md"
            icon="refresh"
            onClick={onRetry}
            className="shadow-lg shadow-rose-950/60 font-bold"
          >
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;

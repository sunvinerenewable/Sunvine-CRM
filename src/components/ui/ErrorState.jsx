import React from 'react';
import Button from './Button';

/**
 * Enterprise Sunvine Error State Component
 * User-friendly error message block with optional retry trigger.
 */

export function ErrorState({
  icon = 'error',
  title = 'Something went wrong',
  description = 'An error occurred while loading this data. Please try again.',
  error = null,
  onRetry = null,
  retryLabel = 'Retry',
  className = ''
}) {
  return (
    <div
      className={`
        w-full p-8 sm:p-10 rounded-2xl border border-rose-500/20 bg-rose-950/20
        flex flex-col items-center justify-center text-center
        ${className}
      `}
      role="alert"
    >
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-inner">
        <span className="material-symbols-outlined text-[2rem] leading-none" aria-hidden="true">
          {icon}
        </span>
      </div>

      <h4 className="text-base sm:text-lg font-bold text-rose-200 tracking-tight">
        {title}
      </h4>

      {description && (
        <p className="text-xs sm:text-sm text-slate-300 max-w-sm mt-1.5 leading-relaxed">
          {description}
        </p>
      )}

      {error && (
        <div className="mt-3 p-2.5 rounded-lg bg-black/40 border border-rose-500/20 text-rose-300 font-mono text-xs max-w-md overflow-x-auto">
          {typeof error === 'string' ? error : error?.message || 'Unknown error details'}
        </div>
      )}

      {onRetry && (
        <div className="mt-6">
          <Button
            variant="outline"
            size="md"
            icon="refresh"
            onClick={onRetry}
            className="!border-rose-500/40 !text-rose-300 hover:!bg-rose-500/10"
          >
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;

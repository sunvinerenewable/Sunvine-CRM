import React from 'react';

export function LoadingSpinner({ message = 'Loading system data...', size = 'md' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4'
  }[size] || 'w-10 h-10 border-3';

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-3 text-secondary animate-in fade-in duration-150">
      <div className={`${sizeClasses} border-primary/20 border-t-primary rounded-full animate-spin`} />
      <span className="text-xs font-medium font-mono">{message}</span>
    </div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title = 'No records found',
  description = 'There are no active records matching your criteria.',
  actionLabel,
  onAction
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-surface-container-lowest rounded-2xl border border-dashed border-surface-container-high space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-surface-container-low text-secondary flex items-center justify-center">
        <span className="material-symbols-outlined text-[32px]">{icon}</span>
      </div>
      <h3 className="font-heading font-bold text-base sm:text-lg text-on-surface">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-secondary max-w-sm leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary font-bold text-xs hover:bg-primary transition-all cursor-pointer shadow-xs min-h-[44px]"
        >
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}

export function ErrorStateDisplay({
  title = 'Unable to complete action',
  message = 'An unexpected error occurred while processing this request.',
  onRetry
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-error-container/10 rounded-2xl border border-error/30 space-y-3">
      <div className="w-12 h-12 rounded-xl bg-error/15 text-error flex items-center justify-center">
        <span className="material-symbols-outlined text-[28px]">error</span>
      </div>
      <h3 className="font-heading font-bold text-base text-on-surface">
        {title}
      </h3>
      <p className="text-xs text-secondary max-w-sm">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface font-semibold text-xs hover:bg-surface-container-high transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          <span>Try Again</span>
        </button>
      )}
    </div>
  );
}

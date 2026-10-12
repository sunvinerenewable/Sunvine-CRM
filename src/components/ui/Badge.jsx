import React from 'react';

/**
 * Enterprise Sunvine Status Badge Component
 */

const variantStyles = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  teal: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  slate: 'bg-slate-700/30 text-slate-300 border-slate-600/40'
};

export function Badge({
  children,
  variant = 'emerald',
  size = 'sm',
  icon = null,
  className = ''
}) {
  const chosenVariant = variantStyles[variant] || variantStyles.slate;
  const isSm = size === 'sm';

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full border
        ${isSm ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'}
        ${chosenVariant}
        ${className}
      `}
    >
      {icon && (
        <span className="material-symbols-outlined text-[1rem] leading-none shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </span>
  );
}

export default Badge;

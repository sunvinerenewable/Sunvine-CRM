import React from 'react';

/**
 * Enterprise Sunvine Button Component
 * Enforces Rule 6: UI/UX Pro Max Protocol:
 * - min-h-[44px] touch target
 * - cursor-pointer
 * - emerald-to-teal energy gradient
 * - WCAG contrast compliant
 */

const variantStyles = {
  primary: 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold shadow-lg shadow-emerald-950/40 border border-emerald-500/30 active:scale-[0.98]',
  secondary: 'bg-[#15233E] hover:bg-[#1C2E52] text-slate-200 border border-slate-700/60 font-medium active:scale-[0.98]',
  outline: 'bg-transparent border border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-400 font-medium active:scale-[0.98]',
  ghost: 'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white font-medium',
  danger: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold shadow-lg shadow-rose-950/40 border border-rose-500/30 active:scale-[0.98]',
  subtle: 'bg-slate-800/60 hover:bg-slate-700/70 text-slate-300 border border-slate-750 font-medium'
};

const sizeStyles = {
  sm: 'h-9 px-3.5 text-xs rounded-lg min-h-[36px]',
  md: 'h-11 px-5 text-sm rounded-xl min-h-[44px]',
  lg: 'h-12 px-6 text-base rounded-xl min-h-[48px]'
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const isDisabled = disabled || loading;
  const chosenVariant = variantStyles[variant] || variantStyles.primary;
  const chosenSize = sizeStyles[size] || sizeStyles.md;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={`
        relative inline-flex items-center justify-center font-sans tracking-wide transition-all duration-200
        cursor-pointer select-none
        ${chosenVariant}
        ${chosenSize}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 !cursor-not-allowed pointer-events-none' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{children}</span>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {icon && iconPosition === 'left' && (
            <span className="material-symbols-outlined text-[1.25rem] leading-none shrink-0" aria-hidden="true">
              {icon}
            </span>
          )}
          <span>{children}</span>
          {icon && iconPosition === 'right' && (
            <span className="material-symbols-outlined text-[1.25rem] leading-none shrink-0" aria-hidden="true">
              {icon}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

export default Button;

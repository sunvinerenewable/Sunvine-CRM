import React, { forwardRef } from 'react';

/**
 * Enterprise Sunvine Form Input Component
 * Enforces Rule 6: High contrast, dark console aesthetics, clear error states.
 */

export const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    icon = null,
    iconPosition = 'left',
    type = 'text',
    className = '',
    inputClassName = '',
    disabled = false,
    required = false,
    id,
    ...props
  },
  ref
) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between"
        >
          <span>
            {label} {required && <span className="text-rose-400">*</span>}
          </span>
        </label>
      )}

      <div className="relative flex items-center">
        {icon && iconPosition === 'left' && (
          <span
            className="absolute left-3.5 material-symbols-outlined text-[1.25rem] text-slate-400 pointer-events-none"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          required={required}
          className={`
            w-full h-11 px-3.5 rounded-xl font-sans text-sm text-slate-100 bg-[#0B132B]/80
            border transition-all duration-150 outline-none
            ${icon && iconPosition === 'left' ? 'pl-11' : ''}
            ${icon && iconPosition === 'right' ? 'pr-11' : ''}
            ${
              error
                ? 'border-rose-500/80 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                : 'border-slate-700/60 hover:border-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-900/50' : ''}
            placeholder:text-slate-500
            ${inputClassName}
          `}
          {...props}
        />

        {icon && iconPosition === 'right' && (
          <span
            className="absolute right-3.5 material-symbols-outlined text-[1.25rem] text-slate-400 pointer-events-none"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>

      {error ? (
        <p className="text-xs text-rose-400 flex items-center gap-1 mt-0.5" role="alert">
          <span className="material-symbols-outlined text-[0.875rem] leading-none shrink-0">error</span>
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-400 mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Input;

import React, { forwardRef } from 'react';

/**
 * Enterprise Sunvine Form Select Component
 */

export const Select = forwardRef(function Select(
  {
    label,
    error,
    helperText,
    options = [],
    className = '',
    selectClassName = '',
    disabled = false,
    required = false,
    children,
    id,
    ...props
  },
  ref
) {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between"
        >
          <span>
            {label} {required && <span className="text-rose-400">*</span>}
          </span>
        </label>
      )}

      <div className="relative flex items-center">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          required={required}
          className={`
            w-full h-11 pl-3.5 pr-10 rounded-xl font-sans text-sm text-slate-100 bg-[#0B132B]/80
            border transition-all duration-150 outline-none appearance-none cursor-pointer
            ${
              error
                ? 'border-rose-500/80 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                : 'border-slate-700/60 hover:border-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-900/50' : ''}
            ${selectClassName}
          `}
          {...props}
        >
          {children ? (
            children
          ) : (
            options.map((opt) => {
              const val = typeof opt === 'object' ? opt.value : opt;
              const lbl = typeof opt === 'object' ? opt.label : opt;
              return (
                <option key={val} value={val} className="bg-[#0D1527] text-slate-200">
                  {lbl}
                </option>
              );
            })
          )}
        </select>

        <span
          className="absolute right-3.5 material-symbols-outlined text-[1.25rem] text-slate-400 pointer-events-none"
          aria-hidden="true"
        >
          expand_more
        </span>
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

export default Select;

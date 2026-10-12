import React, { useState, useRef, useEffect, forwardRef } from 'react';

/**
 * Enterprise Sunvine Custom Select / Dropdown Component
 * Replaces generic OS select menus with an ultra-polished dark console dropdown.
 * - Energy Emerald hover and active selection styling
 * - Smooth rotating chevron
 * - Click-outside and Escape key dismissal
 * - Backward compatible with standard (value, onChange) contract
 */

export const Select = forwardRef(function Select(
  {
    label,
    error,
    helperText,
    options = [],
    value,
    onChange,
    placeholder = 'Select an option...',
    className = '',
    selectClassName = '',
    disabled = false,
    required = false,
    id,
    name,
    ...props
  },
  ref
) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Normalize options array: handles both [{ value, label }, ...] and ['UGVCL', 'DGVCL', ...]
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: String(opt.value),
        label: opt.label || opt.name || String(opt.value),
        icon: opt.icon || null,
        badge: opt.badge || null
      };
    }
    return {
      value: String(opt),
      label: String(opt),
      icon: null,
      badge: null
    };
  });

  // Find currently selected option
  const selectedOption = normalizedOptions.find((opt) => opt.value === String(value));
  const displayText = selectedOption ? selectedOption.label : placeholder;

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optValue) => {
    if (disabled) return;
    setIsOpen(false);

    if (onChange) {
      onChange({
        target: {
          value: optValue,
          name: name || id
        }
      });
    }
  };

  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div ref={containerRef} className={`w-full flex flex-col gap-1.5 relative ${className}`}>
      {/* Label */}
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

      {/* Custom Trigger Button */}
      <div className="relative w-full">
        <button
          ref={ref}
          id={selectId}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`
            w-full h-11 pl-3.5 pr-10 rounded-xl font-sans text-sm text-left
            flex items-center justify-between gap-2 select-none cursor-pointer
            bg-[#0B132B] border transition-all duration-200 outline-none
            ${
              error
                ? 'border-rose-500/80 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                : isOpen
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-950/30'
                : 'border-slate-700/80 hover:border-slate-600 focus:border-emerald-500'
            }
            ${disabled ? 'opacity-50 !cursor-not-allowed bg-slate-900/60' : ''}
            ${selectClassName}
          `}
          {...props}
        >
          <span className={`truncate flex-1 font-medium ${selectedOption ? 'text-slate-100' : 'text-slate-400'}`}>
            {displayText}
          </span>

          <span
            className={`
              material-symbols-outlined text-[1.25rem] text-slate-400 transition-transform duration-200 shrink-0
              ${isOpen ? 'rotate-180 text-emerald-400' : ''}
            `}
            aria-hidden="true"
          >
            expand_more
          </span>
        </button>

        {/* Floating Custom Dropdown Menu */}
        {isOpen && (
          <div
            role="listbox"
            tabIndex={-1}
            className="
              absolute top-full left-0 right-0 mt-1.5 z-50
              bg-[#0D1527] border border-slate-700/90 rounded-xl shadow-2xl shadow-black/90
              backdrop-blur-xl overflow-hidden py-1 max-h-60 overflow-y-auto
              animate-scale-up
            "
          >
            {normalizedOptions.length === 0 ? (
              <div className="px-3.5 py-3 text-xs text-slate-400 text-center">
                No options available
              </div>
            ) : (
              normalizedOptions.map((opt) => {
                const isSelected = opt.value === String(value);

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={`
                      w-full px-3.5 py-2.5 text-xs sm:text-sm text-left flex items-center justify-between gap-3
                      cursor-pointer transition-colors duration-150 min-h-[40px]
                      ${
                        isSelected
                          ? 'bg-gradient-to-r from-emerald-600/20 to-teal-500/10 text-emerald-300 font-semibold border-l-2 border-emerald-400'
                          : 'text-slate-200 hover:bg-slate-800/70 hover:text-white'
                      }
                    `}
                  >
                    <span className="truncate flex-1">{opt.label}</span>

                    {isSelected && (
                      <span className="material-symbols-outlined text-emerald-400 text-[1.125rem] leading-none shrink-0" aria-hidden="true">
                        check
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Error Message or Helper Text */}
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

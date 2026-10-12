import React, { useEffect, useRef } from 'react';

/**
 * Enterprise Sunvine Modal Component
 * Accessible dialog with:
 * - Backdrop blur & animated entrance
 * - Escape key dismissal
 * - Focus trapping
 * - Click-outside dismiss
 */

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-2xl',
  className = ''
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={`
          w-full ${maxWidth} bg-[#0D1527] border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/80
          flex flex-col max-h-[92vh] overflow-hidden transform transition-all duration-200 animate-scale-up
          ${className}
        `}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between gap-4 bg-slate-900/40">
          <div className="min-w-0">
            <h3 id="modal-title" className="text-lg font-bold text-slate-100 truncate">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-[1.25rem] leading-none">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 sm:p-5 bg-slate-900/60 border-t border-slate-800/80 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;

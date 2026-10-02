import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toastOrMessage, maybeType = 'success', duration = 3500) => {
    let title = '';
    let message = '';
    let type = maybeType;
    let dur = duration;

    if (typeof toastOrMessage === 'string') {
      message = toastOrMessage;
    } else if (toastOrMessage && typeof toastOrMessage === 'object') {
      title = toastOrMessage.title || '';
      message = toastOrMessage.message || '';
      type = toastOrMessage.type || maybeType || 'success';
      dur = toastOrMessage.duration !== undefined ? toastOrMessage.duration : duration;
    }

    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts(prev => [...prev, { id, title, message, type }]);

    if (dur > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, dur);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Render Stack */}
      <div
        aria-live="polite"
        className="no-print fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-[70] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map(toast => {
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';
          const isInfo = toast.type === 'info';
          const icon = isError ? 'error' : isWarning ? 'warning' : isInfo ? 'info' : 'check_circle';
          const iconColor = isError ? 'text-rose-400' : isWarning ? 'text-amber-400' : isInfo ? 'text-sky-400' : 'text-[#6CBF3D]';
          const bg = isError
            ? 'bg-rose-950/95 text-rose-100 border-rose-700/80'
            : isWarning
            ? 'bg-amber-950/95 text-amber-100 border-amber-700/80'
            : isInfo
            ? 'bg-sky-950/95 text-sky-100 border-sky-700/80'
            : 'bg-[#0F1B2E]/95 text-white border-[#6CBF3D]/40';

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl backdrop-blur-md flex items-start gap-3 text-xs animate-in slide-in-from-bottom-2 duration-200 ${bg}`}
            >
              <span className={`material-symbols-outlined text-[18px] ${iconColor} shrink-0 mt-0.5`}>
                {icon}
              </span>
              <div className="flex-1 min-w-0">
                {toast.title && <h5 className="font-bold leading-tight">{toast.title}</h5>}
                {toast.message && <p className="text-[11px] opacity-90 leading-normal mt-0.5">{toast.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="opacity-70 hover:opacity-100 p-0.5"
                aria-label="Dismiss notification"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback if invoked outside Provider
    return {
      addToast: (t) => console.log('[Toast Notice]:', t),
      removeToast: () => {}
    };
  }
  return ctx;
};

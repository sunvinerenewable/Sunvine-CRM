import React, { useState, useEffect } from 'react';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestoredNotice(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestoredNotice) {
    return null;
  }

  // Connection Restored Notification Banner
  if (isOnline && showRestoredNotice) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="no-print fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200"
      >
        <span className="material-symbols-outlined text-[18px]">wifi</span>
        <span>Internet connection restored. All data up to date.</span>
        <button
          type="button"
          onClick={() => setShowRestoredNotice(false)}
          className="ml-2 hover:opacity-80 p-0.5"
          aria-label="Dismiss message"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </aside>
    );
  }

  // Offline Notification Banner
  return (
    <aside
      role="alert"
      aria-live="assertive"
      className="no-print fixed bottom-20 md:bottom-6 left-4 sm:left-6 right-4 sm:right-auto z-50 max-w-md bg-amber-900/95 text-amber-100 px-4 py-3 rounded-2xl shadow-xl border border-amber-600/40 backdrop-blur-md flex items-start gap-3 text-xs animate-in slide-in-from-bottom-3 duration-200"
    >
      <span className="material-symbols-outlined text-[20px] text-amber-300 shrink-0 mt-0.5">wifi_off</span>
      <div className="flex-1">
        <p className="font-bold text-amber-200 text-xs">You are currently offline</p>
        <p className="text-[11px] text-amber-100/90 leading-tight mt-0.5">
          Local proposals and cached Gujarat dealer registers remain accessible. Cloud sync will resume automatically once connection returns.
        </p>
      </div>
    </aside>
  );
}

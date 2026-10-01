import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

/**
 * LoadingContext
 * Strictly bound to explicit user interactions (button clicks, form submissions).
 * Excludes background synchronization, polling, and heartbeat checks.
 */
const LoadingContext = createContext({
  isLoading: false,
  message: '',
  showLoader: (msg) => {},
  hideLoader: () => {},
  withLoader: async (actionPromiseOrFn, msg) => {}
});

export function LoadingProvider({ children }) {
  const [loadingCount, setLoadingCount] = useState(0);
  const [message, setMessage] = useState('');
  const safetyTimeoutRef = useRef(null);

  const clearSafetyTimeout = useCallback(() => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }, []);

  const hideLoader = useCallback(() => {
    clearSafetyTimeout();
    setLoadingCount(prev => Math.max(0, prev - 1));
  }, [clearSafetyTimeout]);

  const showLoader = useCallback((msg = 'Processing...') => {
    clearSafetyTimeout();
    setMessage(msg);
    setLoadingCount(prev => prev + 1);

    // Failsafe: Automatically dismiss after 15s to guarantee UI never gets stuck
    safetyTimeoutRef.current = setTimeout(() => {
      setLoadingCount(0);
      setMessage('');
    }, 15000);
  }, [clearSafetyTimeout]);

  /**
   * withLoader: Executes an explicit user-triggered action while showing the loader.
   * Cleans up automatically in finally block.
   */
  const withLoader = useCallback(async (actionFn, msg = 'Processing...') => {
    showLoader(msg);
    try {
      if (typeof actionFn === 'function') {
        return await actionFn();
      }
      return await actionFn;
    } finally {
      hideLoader();
    }
  }, [showLoader, hideLoader]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__sunvineLoader = { show: showLoader, hide: hideLoader };
    }
  }, [showLoader, hideLoader]);

  const isLoading = loadingCount > 0;

  return (
    <LoadingContext.Provider value={{ isLoading, message, showLoader, hideLoader, withLoader }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  return useContext(LoadingContext);
}

export default LoadingContext;

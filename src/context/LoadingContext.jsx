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
  const [isLoading, setIsLoading] = useState(false);
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
    setIsLoading(false);
    setMessage('');
  }, [clearSafetyTimeout]);

  const showLoader = useCallback((msg = 'Processing...') => {
    clearSafetyTimeout();
    setMessage(msg);
    setIsLoading(true);

    // Failsafe: Automatically dismiss after 8s to guarantee UI never gets stuck
    safetyTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setMessage('');
    }, 8000);
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

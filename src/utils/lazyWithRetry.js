import { lazy } from 'react';

/**
 * lazyWithRetry wraps React.lazy to gracefully handle chunk load failures,
 * stale deployment bundles, and network drops by automatically reloading the
 * browser once to fetch the latest application bundle.
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const sessionKey = 'sunvine_retry_reload';
    const lastReload = sessionStorage.getItem(sessionKey);
    const now = Date.now();
    const hasRecentlyReloaded = lastReload && (now - Number(lastReload) < 10000);

    try {
      const module = await componentImport();
      // Clear flag on successful load
      if (lastReload) sessionStorage.removeItem(sessionKey);
      return module;
    } catch (error) {
      console.warn('[Sunvine] Dynamic chunk import error caught:', error?.message);

      // If we haven't reloaded recently, silently reload to fetch the latest chunk index
      if (!hasRecentlyReloaded) {
        sessionStorage.setItem(sessionKey, String(now));
        window.location.reload();
        // Return a pending promise so React doesn't render an error boundary while reloading
        return new Promise(() => {});
      }

      // If already reloaded recently, try one more attempt
      try {
        return await componentImport();
      } catch (finalError) {
        throw finalError;
      }
    }
  });
}

export default lazyWithRetry;

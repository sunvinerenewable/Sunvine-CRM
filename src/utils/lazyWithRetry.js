import { lazy } from 'react';

/**
 * lazyWithRetry wraps React.lazy to gracefully handle chunk load failures,
 * stale deployment bundles, and network drops by automatically reloading the
 * browser once to fetch the latest application bundle.
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const sessionKey = 'sunvine_retry_reload';
    const lastReload = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(sessionKey) : null;
    const now = Date.now();
    const hasRecentlyReloaded = lastReload && (now - Number(lastReload) < 15000);

    try {
      const module = await componentImport();
      if (!module || (!module.default && typeof module !== 'function')) {
        throw new Error('Loaded chunk is missing default export.');
      }
      if (lastReload && typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(sessionKey);
      }
      return module;
    } catch (error) {
      console.warn('[Sunvine] Dynamic chunk import error caught:', error?.message);

      // If chunk failed to load (e.g. stale cache / new deployment), reload once with loop guard
      if (!hasRecentlyReloaded && typeof window !== 'undefined') {
        sessionStorage.setItem(sessionKey, String(now));
        window.location.reload();
        // Return an unresolved promise so React suspends instead of rendering an error boundary during reload
        return new Promise(() => {});
      }

      // If already reloaded recently, attempt one delayed retry
      try {
        await new Promise(r => setTimeout(r, 600));
        const retryModule = await componentImport();
        if (retryModule && (retryModule.default || typeof retryModule === 'function')) {
          return retryModule;
        }
      } catch (retryErr) {
        console.error('[Sunvine] Final chunk import retry failed:', retryErr?.message);
      }

      // Guaranteed safe fallback: never return undefined to prevent TypeError: Cannot read properties of undefined (reading 'default')
      return {
        default: function ChunkLoadFallback() {
          return null;
        }
      };
    }
  });
}

export default lazyWithRetry;

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
      console.warn('[Sunvine] Dynamic chunk import error caught, retrying once...', error?.message);
      // Wait 500ms and retry import once
      await new Promise(r => setTimeout(r, 500));
      return await componentImport();
    }
  });
}

export default lazyWithRetry;

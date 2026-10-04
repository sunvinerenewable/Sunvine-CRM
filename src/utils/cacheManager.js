/**
 * Lightweight Zero-Dependency SWR / Local Storage Cache Manager
 * Provides sub-millisecond local reads with stale-while-revalidate background refresh.
 */

const CACHE_PREFIX = 'sunvine_cache_';
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour default TTL for catalog items

export const cacheManager = {
  /**
   * Get cached data synchronously from localStorage
   */
  get(key, fallback = null) {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'data' in parsed) {
        return parsed.data;
      }
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  },

  /**
   * Save data to localStorage with timestamp
   */
  set(key, data, ttlMs = DEFAULT_TTL_MS) {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        data,
        timestamp: Date.now(),
        ttlMs
      };
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(payload));
    } catch {
      // Handle storage quota limits gracefully
    }
  },

  /**
   * Check if cache is stale
   */
  isStale(key) {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return true;
      const parsed = JSON.parse(raw);
      if (!parsed?.timestamp || !parsed?.ttlMs) return true;
      return Date.now() - parsed.timestamp > parsed.ttlMs;
    } catch {
      return true;
    }
  },

  /**
   * Remove item from cache
   */
  remove(key) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch {}
  }
};

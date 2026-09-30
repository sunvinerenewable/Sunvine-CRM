/**
 * Rate Limiter Utility for Sunvine API Endpoints
 * In-memory sliding window rate limiter against brute-force attacks.
 * Strictly adheres to Ponytail protocol (Zero external dependencies).
 */

const tracker = new Map();
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Periodic cleanup of stale IP records
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of tracker.entries()) {
      if (now > record.resetAt) {
        tracker.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref?.();
}

/**
 * Check rate limit for an action
 * @param {string} identifier - Client IP or User ID
 * @param {object} options - { maxAttempts: 5, windowMs: 15 * 60 * 1000 }
 * @returns {object} { allowed: boolean, remaining: number, resetSeconds: number }
 */
export function checkRateLimit(identifier, options = {}) {
  const maxAttempts = options.maxAttempts || 5;
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 mins default
  const now = Date.now();

  let record = tracker.get(identifier);
  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + windowMs };
    tracker.set(identifier, record);
  }

  record.count += 1;
  const remaining = Math.max(0, maxAttempts - record.count);
  const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

  return {
    allowed: record.count <= maxAttempts,
    remaining,
    resetSeconds,
    totalAttempts: record.count
  };
}

/**
 * Reset rate limit record upon successful authentication
 */
export function resetRateLimit(identifier) {
  tracker.delete(identifier);
}

/**
 * Extract client IP reliably across proxies / Vercel Edge / Cloudflare
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

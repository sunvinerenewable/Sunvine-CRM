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
 * Check if an identifier is currently rate-limited (without incrementing)
 * @param {string} identifier - Client IP or User ID
 * @param {object} options - { maxAttempts: 20, windowMs: 5 * 60 * 1000 }
 * @returns {object} { blocked: boolean, remaining: number, resetSeconds: number }
 */
export function isRateLimited(identifier, options = {}) {
  const maxAttempts = options.maxAttempts || 20;
  const windowMs = options.windowMs || 5 * 60 * 1000; // 5 mins default
  const now = Date.now();

  const record = tracker.get(identifier);
  if (!record || now > record.resetAt) {
    return { blocked: false, remaining: maxAttempts, resetSeconds: 0, totalAttempts: 0 };
  }

  const blocked = record.count >= maxAttempts;
  const remaining = Math.max(0, maxAttempts - record.count);
  const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

  return { blocked, remaining, resetSeconds, totalAttempts: record.count };
}

/**
 * Record a failed authentication attempt
 * @param {string} identifier - Client IP or User ID
 * @param {object} options - { maxAttempts: 20, windowMs: 5 * 60 * 1000 }
 * @returns {object} { allowed: boolean, remaining: number, resetSeconds: number }
 */
export function recordFailedAttempt(identifier, options = {}) {
  const maxAttempts = options.maxAttempts || 20;
  const windowMs = options.windowMs || 5 * 60 * 1000;
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
 * Check rate limit for an action
 * If options.increment === false, only checks status without recording attempt.
 * @param {string} identifier - Client IP or User ID
 * @param {object} options - { maxAttempts: 20, windowMs: 5 * 60 * 1000, increment: boolean }
 * @returns {object} { allowed: boolean, remaining: number, resetSeconds: number }
 */
export function checkRateLimit(identifier, options = {}) {
  if (options.increment === false) {
    const status = isRateLimited(identifier, options);
    return {
      allowed: !status.blocked,
      remaining: status.remaining,
      resetSeconds: status.resetSeconds,
      totalAttempts: status.totalAttempts
    };
  }

  return recordFailedAttempt(identifier, options);
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

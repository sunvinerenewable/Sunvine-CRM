/**
 * Rate Limiter Utility for Sunvine API Endpoints
 *
 * Supports:
 * 1. Upstash Redis REST (when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set)
 *    -> Shared distributed state across all Vercel serverless cold starts.
 * 2. In-Memory fallback (when Upstash is not configured or in local dev).
 */

const tracker = new Map();
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

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
 * Check if Upstash is configured
 */
function hasUpstash() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Check and increment rate limit via Upstash Redis REST
 */
export async function checkDistributedRateLimit(identifier, options = {}) {
  const maxAttempts = options.maxAttempts || 20;
  const windowSeconds = Math.ceil((options.windowMs || 5 * 60 * 1000) / 1000);
  const key = `ratelimit:${identifier}`;

  if (!hasUpstash()) {
    return checkRateLimit(identifier, options);
  }

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    // INCR and EXPIRE in pipeline
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, windowSeconds, 'NX'],
        ['TTL', key]
      ])
    });

    if (res.ok) {
      const data = await res.json();
      const count = data?.[0]?.result || 1;
      const ttl = Math.max(1, data?.[2]?.result || windowSeconds);
      const remaining = Math.max(0, maxAttempts - count);
      return {
        allowed: count <= maxAttempts,
        remaining,
        resetSeconds: ttl,
        totalAttempts: count
      };
    }
  } catch (err) {
    console.warn('[RateLimiter] Upstash unreachable, falling back to local:', err.message);
  }

  return checkRateLimit(identifier, options);
}

/**
 * Local synchronous check / record
 */
export function isRateLimited(identifier, options = {}) {
  const maxAttempts = options.maxAttempts || 20;
  const windowMs = options.windowMs || 5 * 60 * 1000;
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

export function resetRateLimit(identifier) {
  tracker.delete(identifier);
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

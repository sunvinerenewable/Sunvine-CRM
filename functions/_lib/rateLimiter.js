import { redisDel, redisFlushPattern, isRedisConfigured } from './redis.js';

const tracker = new Map();

export async function checkDistributedRateLimit(env, identifier, options = {}) {
  const maxAttempts = options.maxAttempts || 20;
  const windowSeconds = Math.ceil((options.windowMs || 5 * 60 * 1000) / 1000);
  const key = identifier.startsWith('ratelimit:') ? identifier : `ratelimit:${identifier}`;
  const isProd = (env?.NODE_ENV || process.env?.NODE_ENV) === 'production';

  if (!isRedisConfigured(env)) {
    if (isProd) {
      throw new Error('[RateLimiter FATAL] Upstash Redis is not configured in production.');
    }
    return checkRateLimit(identifier, options);
  }

  try {
    const url = env?.UPSTASH_REDIS_REST_URL || process.env?.UPSTASH_REDIS_REST_URL;
    const token = env?.UPSTASH_REDIS_REST_TOKEN || process.env?.UPSTASH_REDIS_REST_TOKEN;

    if (options.increment === false) {
      const getRes = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['GET', key], ['TTL', key]]),
        signal: AbortSignal.timeout(1000)
      });
      if (getRes.ok) {
        const data = await getRes.json();
        const count = parseInt(data?.[0]?.result || '0', 10);
        const ttl = Math.max(1, data?.[1]?.result || windowSeconds);
        const remaining = Math.max(0, maxAttempts - count);
        return {
          allowed: count < maxAttempts,
          remaining,
          resetSeconds: ttl,
          totalAttempts: count
        };
      }
    } else {
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
        ]),
        signal: AbortSignal.timeout(1000)
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
    }
  } catch (err) {
    console.warn('[RateLimiter] Upstash unreachable, falling back to local memory:', err.message);
  }

  return checkRateLimit(identifier, options);
}

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

export async function resetRateLimit(env, identifier) {
  const rawKey = identifier.startsWith('ratelimit:') ? identifier.slice('ratelimit:'.length) : identifier;
  tracker.delete(rawKey);
  tracker.delete(identifier);
  const redisKey = identifier.startsWith('ratelimit:') ? identifier : `ratelimit:${identifier}`;
  await redisDel(env, redisKey).catch(() => {});
}

export async function resetAllRateLimits(env) {
  tracker.clear();
  await redisFlushPattern(env, 'ratelimit:*').catch(() => {});
}

export function getClientIp(request) {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim();
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp;
  return '127.0.0.1';
}

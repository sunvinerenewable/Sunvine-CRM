/**
 * High-Performance Upstash Redis Client & Caching Engine for Sunvine Pages Functions
 */

const localMemoryCache = new Map();

function getRedisConfig(env) {
  const url = env?.UPSTASH_REDIS_REST_URL || process.env?.UPSTASH_REDIS_REST_URL;
  const token = env?.UPSTASH_REDIS_REST_TOKEN || process.env?.UPSTASH_REDIS_REST_TOKEN;
  return (url && token) ? { url, token } : null;
}

export function isRedisConfigured(env) {
  return Boolean(getRedisConfig(env));
}

export async function redisCommand(env, command, ...args) {
  const config = getRedisConfig(env);
  const isProd = (env?.NODE_ENV || process.env?.NODE_ENV) === 'production';

  if (!config) {
    if (isProd) {
      throw new Error('[Redis FATAL] Upstash Redis credentials missing in production.');
    }
    return null;
  }

  try {
    const res = await fetch(`${config.url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([command, ...args]),
      signal: AbortSignal.timeout(1500)
    });

    if (!res.ok) {
      console.warn(`[Redis] Command ${command} failed with status:`, res.status);
      if (isProd) {
        throw new Error(`[Redis FATAL] Upstash Redis command ${command} failed with status ${res.status}`);
      }
      return null;
    }

    const json = await res.json();
    return json?.result;
  } catch (err) {
    if (isProd) {
      throw new Error(`[Redis FATAL] Upstash Redis command ${command} error: ${err.message}`);
    }
    console.warn(`[Redis] Exception on command ${command}:`, err.message);
    return null;
  }
}

export async function redisGet(env, key) {
  const config = getRedisConfig(env);
  if (config) {
    const raw = await redisCommand(env, 'GET', key);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  const item = localMemoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    localMemoryCache.delete(key);
    return null;
  }
  return item.value;
}

export async function redisSet(env, key, value, ttlSeconds = 300) {
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const config = getRedisConfig(env);

  if (config) {
    if (ttlSeconds > 0) {
      await redisCommand(env, 'SET', key, serialized, 'EX', ttlSeconds);
    } else {
      await redisCommand(env, 'SET', key, serialized);
    }
    return true;
  }

  localMemoryCache.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
  return true;
}

export async function redisDel(env, key) {
  const config = getRedisConfig(env);
  if (config) {
    await redisCommand(env, 'DEL', key);
  }
  localMemoryCache.delete(key);
  return true;
}

export async function redisFlushPattern(env, pattern = '*') {
  const config = getRedisConfig(env);
  if (config) {
    try {
      if (pattern === '*') {
        await redisCommand(env, 'FLUSHDB');
      } else {
        const keys = await redisCommand(env, 'KEYS', pattern);
        if (Array.isArray(keys) && keys.length > 0) {
          await redisCommand(env, 'DEL', ...keys);
        }
      }
    } catch (err) {
      console.warn('[Redis] Flush pattern warning:', err.message);
    }
  }

  if (pattern === '*') {
    localMemoryCache.clear();
  } else {
    for (const k of localMemoryCache.keys()) {
      if (k.startsWith(pattern.replace('*', ''))) {
        localMemoryCache.delete(k);
      }
    }
  }
}

export async function cacheAside(env, key, ttlSeconds, fetcherFn) {
  try {
    const cached = await redisGet(env, key);
    if (cached !== null && cached !== undefined) {
      return { data: cached, fromCache: true };
    }
  } catch (err) {
    console.warn(`[Redis Cache-Aside] Read miss for key "${key}":`, err.message);
  }

  const freshData = await fetcherFn();
  if (freshData !== undefined && freshData !== null) {
    try {
      await redisSet(env, key, freshData, ttlSeconds);
    } catch (err) {
      console.warn(`[Redis Cache-Aside] Write fail for key "${key}":`, err.message);
    }
  }

  return { data: freshData, fromCache: false };
}

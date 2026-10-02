/**
 * High-Performance Upstash Redis Client & Caching Engine for Sunvine Solar Backend
 *
 * Provides:
 * - Distributed Key-Value Caching (GET, SET, DEL, TTL)
 * - Cache-Aside pattern helper for database queries & external APIs
 * - Fallback to in-memory store when Redis is offline or not configured
 */

import { ensureEnvLoaded } from './db.js';

ensureEnvLoaded();

const localMemoryCache = new Map();

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return (url && token) ? { url, token } : null;
}

export function isRedisConfigured() {
  return Boolean(getRedisConfig());
}

/**
 * Execute a raw command or pipeline against Upstash Redis REST
 */
export async function redisCommand(command, ...args) {
  const config = getRedisConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([command, ...args]),
      signal: AbortSignal.timeout(200)
    });

    if (!res.ok) {
      console.warn(`[Redis] Command ${command} failed with status:`, res.status);
      return null;
    }

    const json = await res.json();
    return json?.result;
  } catch (err) {
    if (err.name !== 'TimeoutError' && err.name !== 'AbortError') {
      console.warn(`[Redis] Exception on command ${command}:`, err.message);
    }
    return null;
  }
}

/**
 * Get a cached JSON or string value from Redis
 */
export async function redisGet(key) {
  const config = getRedisConfig();
  if (config) {
    const raw = await redisCommand('GET', key);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  // In-memory fallback
  const item = localMemoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    localMemoryCache.delete(key);
    return null;
  }
  return item.value;
}

/**
 * Set a JSON or string value with optional TTL in seconds
 */
export async function redisSet(key, value, ttlSeconds = 300) {
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const config = getRedisConfig();

  if (config) {
    if (ttlSeconds > 0) {
      await redisCommand('SET', key, serialized, 'EX', ttlSeconds);
    } else {
      await redisCommand('SET', key, serialized);
    }
    return true;
  }

  // In-memory fallback
  localMemoryCache.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
  return true;
}

/**
 * Delete a specific key from Redis
 */
export async function redisDel(key) {
  const config = getRedisConfig();
  if (config) {
    await redisCommand('DEL', key);
  }
  localMemoryCache.delete(key);
  return true;
}

/**
 * Clear all keys or pattern matching in Redis (e.g. 'ratelimit:*')
 */
export async function redisFlushPattern(pattern = '*') {
  const config = getRedisConfig();
  if (config) {
    try {
      if (pattern === '*') {
        await redisCommand('FLUSHDB');
      } else {
        const keys = await redisCommand('KEYS', pattern);
        if (Array.isArray(keys) && keys.length > 0) {
          await redisCommand('DEL', ...keys);
        }
      }
    } catch (err) {
      console.warn('[Redis] Flush pattern warning:', err.message);
    }
  }

  // Clear in-memory
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

/**
 * Cache-Aside wrapper: Returns cached value or fetches from fetcher and saves to Redis
 */
export async function cacheAside(key, ttlSeconds, fetcherFn) {
  try {
    const cached = await redisGet(key);
    if (cached !== null && cached !== undefined) {
      return { data: cached, fromCache: true };
    }
  } catch (err) {
    console.warn(`[Redis Cache-Aside] Read miss for key "${key}":`, err.message);
  }

  const freshData = await fetcherFn();
  if (freshData !== undefined && freshData !== null) {
    try {
      await redisSet(key, freshData, ttlSeconds);
    } catch (err) {
      console.warn(`[Redis Cache-Aside] Write fail for key "${key}":`, err.message);
    }
  }

  return { data: freshData, fromCache: false };
}

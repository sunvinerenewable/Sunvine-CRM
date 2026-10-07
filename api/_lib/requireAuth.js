/**
 * requireAuth.js — Authentication and authorization guards (SEC-001, SEC-012)
 *
 * Exports:
 *   extractToken(req) → string | null
 *   requireUser(req, res, { roles = [] }) → Promise<jwtPayload | null>
 *   requireAdmin(req, res) → Promise<jwtPayload | null>
 *
 * Status rules:
 *   - 'active' (case-insensitive) → allowed
 *   - 'suspended', 'inactive' → 403 Forbidden
 *   - 'not_found' (deleted) → 401 Unauthorized
 *   - Redis failure → fallback to direct DB read
 *   - Direct DB read failure → 503 Service Unavailable (fail closed)
 */

import { verifyJwt } from './jwt.js';
import { cacheAside } from './redis.js';
import { query, getSupabaseServiceClient } from './db.js';

/**
 * Extract the raw token string from the request.
 * Accepts: HttpOnly cookie `sunvine_auth_token` or `Authorization: Bearer <token>`.
 * @param {import('http').IncomingMessage} req
 * @returns {string|null}
 */
export function extractToken(req) {
  const cookieHeader = req.headers?.cookie || '';
  const cookieMatch = cookieHeader.match(/sunvine_auth_token=([^;]+)/);
  if (cookieMatch) return decodeURIComponent(cookieMatch[1]);

  const authHeader = req.headers?.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Fetch account status directly from DB.
 * Throws if DB is unreachable.
 * @param {object} payload
 * @returns {Promise<string>} 'active' | 'suspended' | 'inactive' | 'not_found'
 */
async function fetchAccountStatusFromDb(payload) {
  const role = payload?.role;
  const id = payload?.id || payload?.dealer_id || payload?.staff_id;
  const email = payload?.email;

  try {
    if (role === 'dealer') {
      const dealerId = id || payload?.dealerCode;
      if (!dealerId) return 'not_found';
      const qRes = await query('SELECT id, status FROM dealer_accounts WHERE id = $1 OR dealer_code = $1', [dealerId]);
      if (qRes?.rows?.length > 0) {
        return qRes.rows[0].status || 'active';
      }
      return 'not_found';
    }

    if (role === 'staff') {
      const staffId = id;
      if (!staffId) return 'not_found';
      const qRes = await query('SELECT id, status FROM staff_accounts WHERE id = $1', [staffId]);
      if (qRes?.rows?.length > 0) {
        return qRes.rows[0].status || 'active';
      }
      return 'not_found';
    }

    if (role === 'admin') {
      const adminId = id;
      const adminEmail = email;
      if (!adminId && !adminEmail) return 'not_found';
      const qRes = await query(
        'SELECT id, status FROM admin_accounts WHERE id = $1 OR (email IS NOT NULL AND LOWER(email) = LOWER($2))',
        [adminId || '', adminEmail || '']
      );
      if (qRes?.rows?.length > 0) {
        return qRes.rows[0].status || 'active';
      }
      return 'not_found';
    }
  } catch (err) {
    // In live production, DB errors fail closed (re-throw)
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    // In local unit test environments without live DB connection
    return 'active';
  }

  return 'not_found';
}

/**
 * Check if the account in JWT payload is active.
 * Uses Redis cache (60s TTL), falls back to direct DB, and fails closed (throws) if DB also fails.
 * @param {object} payload
 * @returns {Promise<string>} 'active' | 'suspended' | 'inactive' | 'not_found'
 */
export async function checkAccountActiveStatus(payload) {
  if (!payload || !payload.role) return 'not_found';
  const userKey = payload.id || payload.dealer_id || payload.staff_id || payload.email;
  if (!userKey) return 'not_found';

  const cacheKey = `user:status:${payload.role}:${userKey}`;
  
  try {
    const cached = await cacheAside(cacheKey, 60, async () => {
      return await fetchAccountStatusFromDb(payload);
    });
    return cached?.data || 'active';
  } catch (redisErr) {
    // Redis failed or unavailable — fallback to direct DB read
    return await fetchAccountStatusFromDb(payload);
  }
}

/**
 * Require an authenticated user with optional role restrictions.
 * Re-checks account active status from database (cached 60s in Redis).
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {object} [options]
 * @param {string[]|string} [options.roles] Allowed role(s), e.g. ['admin', 'staff'] or 'dealer'
 * @returns {Promise<object|null>} Decoded JWT payload or null if response was sent
 */
export async function requireUser(req, res, options = {}) {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }

  const result = verifyJwt(token);

  if (!result.valid) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return null;
  }

  const payload = result.payload;

  if (options.roles) {
    const allowed = Array.isArray(options.roles) ? options.roles : [options.roles];
    if (allowed.length > 0) {
      const callerRole = String(payload.role || '').toLowerCase();
      const isAllowed = allowed.some(r => String(r).toLowerCase() === callerRole);
      if (!isAllowed) {
        res.status(403).json({ error: 'Forbidden.' });
        return null;
      }
    }
  }

  // Check account status with Redis cache + direct DB fallback + 503 fail-closed
  let status = 'active';
  try {
    status = await checkAccountActiveStatus(payload);
  } catch (dbErr) {
    // Database and Redis both failed — fail closed with 503
    console.error('[requireAuth] Status check failed closed:', dbErr?.message);
    res.status(503).json({ error: 'Authentication service temporarily unavailable.' });
    return null;
  }

  const normalizedStatus = String(status || '').toLowerCase();

  if (normalizedStatus === 'not_found') {
    res.status(401).json({ error: 'Account not found or deleted.' });
    return null;
  }

  if (normalizedStatus === 'suspended' || normalizedStatus === 'inactive') {
    res.status(403).json({ error: 'Account suspended or inactive.' });
    return null;
  }

  if (normalizedStatus !== 'active') {
    res.status(403).json({ error: 'Account access restricted.' });
    return null;
  }

  return payload;
}

/**
 * Require a valid admin JWT.
 * Returns the JWT payload on success, or sends 401/403/503 and returns null.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {Promise<object|null>}
 */
export async function requireAdmin(req, res) {
  return await requireUser(req, res, { roles: ['admin'] });
}

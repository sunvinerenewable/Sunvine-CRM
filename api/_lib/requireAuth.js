/**
 * requireAuth.js — Authentication and authorization guards (SEC-001, SEC-012)
 *
 * Exports:
 *   extractToken(req) → string | null
 *   requireUser(req, res, options) → jwtPayload | null
 *   requireAdmin(req, res) → jwtPayload | null
 *
 * Returns the verified JWT payload on success.
 * Sends 401/403 and returns null otherwise — callers must `return` on null.
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
 * Fetch account status from DB
 */
async function fetchAccountStatusFromDb(payload) {
  const role = payload?.role;
  const id = payload?.id || payload?.dealer_id || payload?.staff_id;
  const email = payload?.email;

  if (role === 'dealer') {
    const dealerId = id || payload?.dealerCode;
    if (!dealerId) return 'unknown';
    try {
      const qRes = await query('SELECT id, status FROM dealer_accounts WHERE id = $1 OR dealer_code = $1', [dealerId]);
      if (qRes?.rows?.length > 0) {
        return qRes.rows[0].status || 'active';
      }
    } catch (_) {
      try {
        const db = getSupabaseServiceClient();
        const qRes = await db.from('dealer_accounts').select('id, status').or(`id.eq.${dealerId},dealer_code.eq.${dealerId}`);
        if (qRes?.data?.length > 0) {
          return qRes.data[0].status || 'active';
        }
      } catch (_) {}
    }
    return 'not_found';
  }

  if (role === 'staff') {
    const staffId = id;
    if (!staffId) return 'unknown';
    try {
      const qRes = await query('SELECT id, status FROM staff_accounts WHERE id = $1', [staffId]);
      if (qRes?.rows?.length > 0) {
        return qRes.rows[0].status || 'active';
      }
    } catch (_) {
      try {
        const db = getSupabaseServiceClient();
        const qRes = await db.from('staff_accounts').select('id, status').eq('id', staffId);
        if (qRes?.data?.length > 0) {
          return qRes.data[0].status || 'active';
        }
      } catch (_) {}
    }
    return 'not_found';
  }

  if (role === 'admin') {
    const adminId = id;
    const adminEmail = email;
    if (!adminId && !adminEmail) return 'unknown';
    try {
      const qRes = await query(
        'SELECT id, status FROM admin_accounts WHERE id = $1 OR (email IS NOT NULL AND LOWER(email) = LOWER($2))',
        [adminId || '', adminEmail || '']
      );
      if (qRes?.rows?.length > 0) {
        return qRes.rows[0].status || 'active';
      }
    } catch (_) {
      try {
        const db = getSupabaseServiceClient();
        let qRes = await db.from('admin_accounts').select('id, status').eq(adminId ? 'id' : 'email', adminId || adminEmail);
        if ((!qRes?.data || qRes.data.length === 0) && !qRes?.error) {
          qRes = await db.from('admin_users').select('id, status').eq(adminId ? 'id' : 'email', adminId || adminEmail);
        }
        if (qRes?.data?.length > 0) {
          return qRes.data[0].status || 'active';
        }
      } catch (_) {}
    }
    return 'not_found';
  }

  return 'unknown';
}

/**
 * Check if the account in JWT payload is active (cached 60s in Redis)
 */
export async function checkAccountActiveStatus(payload) {
  if (!payload || !payload.role) return true;
  const userKey = payload.id || payload.dealer_id || payload.staff_id || payload.email;
  if (!userKey) return true;

  const cacheKey = `user:status:${payload.role}:${userKey}`;
  
  try {
    const cached = await cacheAside(cacheKey, 60, async () => {
      return await fetchAccountStatusFromDb(payload);
    });

    const status = cached?.data;
    if (status === 'suspended' || status === 'inactive') {
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[requireAuth] Account status check warning:', err.message);
    return true;
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
 * @returns {object|Promise|null} Decoded JWT payload or null if response was sent
 */
export function requireUser(req, res, options = {}) {
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
    if (!allowed.includes(payload.role)) {
      res.status(403).json({ error: 'Forbidden.' });
      return null;
    }
  }

  // Check account active status asynchronously
  const checkPromise = (async () => {
    const isActive = await checkAccountActiveStatus(payload);
    if (!isActive) {
      if (!res.headersSent) {
        res.status(403).json({ error: 'Account suspended or inactive.' });
      }
      return null;
    }
    return payload;
  })();

  // Synchronous and asynchronous dual-compatibility
  return Object.assign(checkPromise, payload);
}

/**
 * Require a valid admin JWT.
 * Returns the JWT payload on success, or sends 401/403 and returns null.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {object|Promise|null}
 */
export function requireAdmin(req, res) {
  return requireUser(req, res, { roles: ['admin'] });
}

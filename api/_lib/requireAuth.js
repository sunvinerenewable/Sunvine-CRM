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
 * Require an authenticated user with optional role restrictions.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {object} [options]
 * @param {string[]|string} [options.roles] Allowed role(s), e.g. ['admin', 'staff'] or 'dealer'
 * @returns {object|null} Decoded JWT payload or null if response was sent
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

  return payload;
}

/**
 * Require a valid admin JWT.
 * Returns the JWT payload on success, or sends 401/403 and returns null.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {object|null}
 */
export function requireAdmin(req, res) {
  return requireUser(req, res, { roles: ['admin'] });
}

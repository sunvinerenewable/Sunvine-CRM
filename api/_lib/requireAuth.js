/**
 * requireAuth.js — Admin JWT guard (SEC-001)
 *
 * Exports:
 *   requireAdmin(req, res) → jwtPayload | null
 *
 * Returns the verified JWT payload when the caller is a valid admin.
 * Sends 401/403 and returns null otherwise — callers must `return` on null.
 */

import { verifyJwt } from './jwt.js';

/**
 * Extract the raw token string from the request.
 * Accepts: HttpOnly cookie `sunvine_auth_token` or `Authorization: Bearer <token>`.
 * @param {import('http').IncomingMessage} req
 * @returns {string|null}
 */
function extractToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookieMatch = cookieHeader.match(/sunvine_auth_token=([^;]+)/);
  if (cookieMatch) return decodeURIComponent(cookieMatch[1]);

  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
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

  if (result.payload.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }

  return result.payload;
}

/**
 * cors.js — CORS allowlist helper (SEC-001)
 *
 * Reads ALLOWED_ORIGINS (comma-separated) from the environment.
 * Only reflects Access-Control-Allow-Origin for origins in the list.
 * No wildcard fallback — fail closed.
 */

/**
 * Apply CORS headers for allowed origins only.
 * Call before any response (including OPTIONS).
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export function applyCors(req, res) {
  const allowedSet = new Set(
    (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean)
  );

  const origin = req.headers.origin;
  if (origin && allowedSet.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

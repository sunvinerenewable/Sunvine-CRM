/**
 * functions/_lib/cors.js — CORS allowlist helper for Cloudflare Pages Functions (SEC-001)
 */

export function getCorsHeaders(request, env) {
  const allowedSet = new Set(
    (env?.ALLOWED_ORIGINS || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean)
  );

  const origin = request?.headers?.get ? request.headers.get('origin') : (request?.headers?.origin || '');
  const headers = new Headers();

  const isProd = env?.NODE_ENV === 'production';
  if (origin && (allowedSet.has(origin) || !isProd)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  headers.set(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  return headers;
}

export function applyCors(req, res) {
  if (res?.setHeader) {
    const origin = req.headers?.origin || '';
    if (origin) {
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
}

export function handleOptionsResponse(request, env) {
  const corsHeaders = getCorsHeaders(request, env);
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}

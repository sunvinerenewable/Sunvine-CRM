import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || process.env.VITE_SUPABASE_ANON_KEY || 'sunvine-epc-secret-auth-key-2026';
const DEFAULT_EXPIRATION_SECONDS = 24 * 60 * 60; // 24 hours

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Sign a payload into a secure JWT
 */
export function signJwt(payload, expiresInSeconds = DEFAULT_EXPIRATION_SECONDS) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iss: 'sunvine-solar-epc',
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify a JWT and return the decoded payload if valid
 */
export function verifyJwt(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed token structure' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Constant-time check for signature
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'Invalid signature' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token has expired' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'Invalid payload encoding' };
  }
}

/**
 * Generate secure Set-Cookie header for HTTP-only cookie
 */
export function createAuthCookieHeader(token, maxAgeSeconds = DEFAULT_EXPIRATION_SECONDS) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  return `sunvine_auth_token=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Strict${isProd ? '; Secure' : ''}`;
}

/**
 * Generate clear Set-Cookie header for logout
 */
export function createClearAuthCookieHeader() {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  return `sunvine_auth_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${isProd ? '; Secure' : ''}`;
}

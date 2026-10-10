import { SignJWT, jwtVerify } from 'jose';

const DEFAULT_EXPIRATION_SECONDS = 24 * 60 * 60; // 24 hours
const EXPECTED_ISSUER = 'sunvine-solar-epc';

function getSecret(env) {
  const secret = env?.JWT_SECRET || process.env?.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      `[FATAL] JWT_SECRET environment variable is missing or too short (min 32 chars). ` +
      'Set it in Cloudflare Pages Dashboard -> Settings -> Environment Variables.'
    );
  }
  return new TextEncoder().encode(secret.trim());
}

/**
 * Sign a payload into a secure JWT using jose
 */
export async function signJwt(payload, env, expiresInSeconds = DEFAULT_EXPIRATION_SECONDS) {
  const secretKey = getSecret(env);
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setJti(crypto.randomUUID())
    .setIssuer(EXPECTED_ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secretKey);
}

/**
 * Verify a JWT and return the decoded payload if valid.
 */
export async function verifyJwt(token, env) {
  if (!token || typeof token !== 'string') return { valid: false, error: 'Token missing' };
  if (token.length > 4096) {
    return { valid: false, error: 'Token exceeds maximum length' };
  }

  let secretKey;
  try {
    secretKey = getSecret(env);
  } catch (err) {
    return { valid: false, error: err.message };
  }

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: EXPECTED_ISSUER,
      algorithms: ['HS256']
    });
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: err.message || 'Invalid or expired token' };
  }
}

/** Generate secure Set-Cookie header for HTTP-only cookie */
export function createAuthCookieHeader(token, env, maxAgeSeconds = DEFAULT_EXPIRATION_SECONDS) {
  const isProd = (env?.NODE_ENV || process.env?.NODE_ENV) === 'production';
  return `sunvine_auth_token=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;
}

/** Generate clear Set-Cookie header for logout */
export function createClearAuthCookieHeader(env) {
  const isProd = (env?.NODE_ENV || process.env?.NODE_ENV) === 'production';
  return `sunvine_auth_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;
}

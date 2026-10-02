import { verifyJwt } from './jwt.js';
import { redisGet } from './redis.js';

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.sunvine_auth_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({ authenticated: false, error: 'No active session token' });
  }

  const result = verifyJwt(token);
  if (!result.valid) {
    return res.status(401).json({ authenticated: false, error: result.error });
  }

  // Check Redis blacklist if token has jti
  if (result.payload?.jti) {
    try {
      const isRevoked = await redisGet(`session:blacklist:${result.payload.jti}`);
      if (isRevoked) {
        return res.status(401).json({ authenticated: false, error: 'Session has been revoked or logged out.' });
      }
    } catch (err) {
      console.warn('[Verify] Redis blacklist check warning:', err.message);
    }
  }

  return res.status(200).json({
    authenticated: true,
    user: result.payload
  });
}

import { verifyJwt, extractAuthToken } from './jwt.js';
import { redisGet } from './redis.js';

export default async function handler(req, res) {
  const token = extractAuthToken(req);

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

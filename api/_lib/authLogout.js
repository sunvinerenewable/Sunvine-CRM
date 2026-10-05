import { createClearAuthCookieHeader, verifyJwt } from './jwt.js';
import { redisSet } from './redis.js';

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
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.sunvine_auth_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (token) {
      const decoded = verifyJwt(token);
      if (decoded.valid && decoded.payload?.jti && decoded.payload?.exp) {
        const remainingSeconds = Math.max(1, decoded.payload.exp - Math.floor(Date.now() / 1000));
        await redisSet(`session:blacklist:${decoded.payload.jti}`, 'revoked', remainingSeconds).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[Logout] Redis blacklist notice:', err.message);
  }

  // Clear the HTTP-only cookie
  res.setHeader('Set-Cookie', createClearAuthCookieHeader());
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}

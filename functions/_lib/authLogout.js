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

export default async function logoutHandler(request, env) {
  try {
    const cookies = parseCookies(request.headers.get('cookie') || '');
    const token = cookies.sunvine_auth_token || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (token) {
      const decoded = await verifyJwt(token, env);
      if (decoded.valid && decoded.payload?.jti && decoded.payload?.exp) {
        const remainingSeconds = Math.max(1, decoded.payload.exp - Math.floor(Date.now() / 1000));
        await redisSet(env, `session:blacklist:${decoded.payload.jti}`, 'revoked', remainingSeconds).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[Logout] Redis blacklist notice:', err.message);
  }

  const clearCookie = createClearAuthCookieHeader(env);
  return Response.json(
    { success: true, message: 'Logged out successfully' },
    {
      status: 200,
      headers: {
        'Set-Cookie': clearCookie
      }
    }
  );
}

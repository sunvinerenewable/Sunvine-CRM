import { verifyJwt } from '../_lib/jwt.js';

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

export default function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.sunvine_auth_token;

  if (!token) {
    return res.status(401).json({ authenticated: false, error: 'No active session token' });
  }

  const result = verifyJwt(token);
  if (!result.valid) {
    return res.status(401).json({ authenticated: false, error: result.error });
  }

  return res.status(200).json({
    authenticated: true,
    user: result.payload
  });
}

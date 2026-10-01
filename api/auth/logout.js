import { createClearAuthCookieHeader } from '../_lib/jwt.js';

export default function handler(req, res) {
  // Clear the HTTP-only cookie
  res.setHeader('Set-Cookie', createClearAuthCookieHeader());
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}

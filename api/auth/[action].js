import loginHandler from '../_lib/authLogin.js';
import logoutHandler from '../_lib/authLogout.js';
import verifyHandler from '../_lib/authVerify.js';
import manageHandler from '../_lib/authManage.js';

export default async function handler(req, res) {
  // CORS & Preflight handling
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const urlPath = req.url ? req.url.split('?')[0] : '';
  const rawAction = req.query?.action || urlPath.split('/').filter(Boolean).pop() || '';
  const action = String(rawAction).toLowerCase().trim();

  switch (action) {
    case 'login':
      return loginHandler(req, res);
    case 'logout':
      return logoutHandler(req, res);
    case 'verify':
      return verifyHandler(req, res);
    case 'manage-credentials':
      return manageHandler(req, res);
    default:
      return res.status(404).json({ error: `Not found: ${action}` });
  }
}

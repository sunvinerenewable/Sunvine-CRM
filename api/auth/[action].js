import loginHandler from '../_lib/authLogin.js';
import logoutHandler from '../_lib/authLogout.js';
import verifyHandler from '../_lib/authVerify.js';
import manageHandler from '../_lib/authManage.js';
import { applyCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  // CORS — allowlist only (SEC-001)
  applyCors(req, res);

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

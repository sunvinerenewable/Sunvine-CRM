import loginHandler from '../_lib/authLogin.js';
import logoutHandler from '../_lib/authLogout.js';
import verifyHandler from '../_lib/authVerify.js';
import manageHandler from '../_lib/authManage.js';
import adminDispatcher, { reportErrorHandler } from '../_lib/adminHandlers.js';
import { requireAdmin } from '../_lib/requireAuth.js';
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
    case 'report-error':
      return reportErrorHandler(req, res);
    case 'admin-dealers':
    case 'admin-staff':
    case 'admin-pricing':
    case 'admin-hardware':
    case 'admin-settings':
    case 'admin-document-master':
    case 'admin-audit-logs': {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
      }
      const adminPayload = await requireAdmin(req, res);
      if (!adminPayload) return; // requireAdmin already sent 401/403
      return adminDispatcher(req, res, action, adminPayload);
    }
    default:
      return res.status(404).json({ error: `Not found: ${action}` });
  }
}

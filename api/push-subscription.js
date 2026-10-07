import { ensureEnvLoaded, query } from './_lib/db.js';
import { requireUser } from './_lib/requireAuth.js';
import { applyCors } from './_lib/cors.js';

ensureEnvLoaded();

export default async function handler(req, res) {
  // CORS / Options preflight handling
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // SEC-010: Require valid JWT
  const user = requireUser(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) {
        return res.status(500).json({ error: 'VAPID public key not configured on server.' });
      }
      return res.status(200).json({ vapidPublicKey: publicKey });
    }

    if (req.method === 'POST') {
      const { action, subscription, userAgent } = req.body || {};

      // SEC-010: Take userId and role strictly from verified JWT payload
      const effectiveUserId = String(user.id || user.userId || user.dealer_id || (user.role === 'admin' ? 'admin' : 'unknown')).trim();
      const effectiveRole = String(user.role || 'staff').trim().toLowerCase();

      if (action === 'unsubscribe') {
        const endpoint = subscription?.endpoint || req.body?.endpoint;
        if (!endpoint) {
          return res.status(400).json({ error: 'Subscription endpoint required to unsubscribe.' });
        }
        await query(
          'DELETE FROM public.push_subscriptions WHERE endpoint = $1 AND (user_id = $2 OR role = $3)',
          [endpoint, effectiveUserId, effectiveRole]
        );
        return res.status(200).json({ success: true, message: 'Unsubscribed successfully.' });
      }

      if (action === 'subscribe') {
        if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
          return res.status(400).json({ error: 'Invalid PushSubscription object with keys.' });
        }

        const endpoint = subscription.endpoint;
        const p256dh = subscription.keys.p256dh;
        const auth = subscription.keys.auth;
        const ua = userAgent || req.headers['user-agent'] || 'browser';

        const sql = `
          INSERT INTO public.push_subscriptions (user_id, role, endpoint, p256dh, auth, user_agent, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (endpoint)
          DO UPDATE SET
            user_id = EXCLUDED.user_id,
            role = EXCLUDED.role,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            user_agent = EXCLUDED.user_agent,
            updated_at = NOW()
          RETURNING id, user_id, role;
        `;

        const result = await query(sql, [effectiveUserId, effectiveRole, endpoint, p256dh, auth, ua]);
        return res.status(200).json({
          success: true,
          subscriptionId: result.rows[0]?.id,
          userId: effectiveUserId,
          role: effectiveRole
        });
      }

      return res.status(400).json({ error: `Unsupported action: ${action}` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/push-subscription] Error:', err);
    return res.status(500).json({ error: err.message || 'Push subscription processing failed' });
  }
}

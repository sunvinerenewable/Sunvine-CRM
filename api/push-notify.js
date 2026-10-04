import webpush from 'web-push';
import { ensureEnvLoaded, query } from './_lib/db.js';

ensureEnvLoaded();

// Configure VAPID details for Web Push protocol
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@sunvinesolar.com';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error('[api/push-notify] VAPID initialization error:', err.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return res.status(500).json({ error: 'VAPID keys not configured on server' });
  }

  const {
    action = 'new-application',
    fileId,
    customerName,
    solarKw,
    dealerId,
    dealerName,
    assignedStaffId,
    assignedStaffName,
    targetUserId,
    role
  } = req.body || {};

  try {
    let targets = ['admin'];
    let notificationPayload = null;

    if (action === 'test') {
      const userTarget = targetUserId || (role === 'admin' ? 'admin' : null);
      if (userTarget) targets = [userTarget];

      notificationPayload = JSON.stringify({
        title: '⚡ Sunvine Solar EPC Test Alert',
        body: `OS push notifications are active and connected! (Target: ${userTarget || role || 'User'})`,
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        url: '/?tab=dashboard',
        data: {
          test: true,
          url: '/?tab=dashboard',
          timestamp: Date.now()
        }
      });
    } else {
      // action === 'new-application'
      // 1. Admin ALWAYS receives notification
      // 2. Salesman receives ONLY IF assigned (not STF-DIRECT)
      // 3. Direct to company (STF-DIRECT): ONLY Admin receives
      const isDirect = !assignedStaffId || assignedStaffId === 'STF-DIRECT';
      if (!isDirect && typeof assignedStaffId === 'string' && assignedStaffId.startsWith('STF-')) {
        targets.push(assignedStaffId);
      }

      const safeKw = parseFloat(solarKw) || 0;
      const safeCust = (customerName || 'Customer').trim();
      const safeDealer = (dealerName || dealerId || 'Authorized Dealer').trim();
      const attribTag = isDirect ? 'Direct Company Desk' : `Sales: ${assignedStaffName || assignedStaffId}`;

      const title = `📁 New Application: ${safeCust} (${safeKw} kW)`;
      const body = `Dealer ${safeDealer} registered a new application. [${attribTag}]`;
      const deepLinkUrl = fileId ? `/?openFile=${fileId}&tab=applications` : '/?tab=applications';

      notificationPayload = JSON.stringify({
        title,
        body,
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        fileId: fileId || '',
        url: deepLinkUrl,
        data: {
          fileId: fileId || '',
          dealerId: dealerId || '',
          dealerName: safeDealer,
          assignedStaffId: assignedStaffId || 'STF-DIRECT',
          url: deepLinkUrl,
          timestamp: Date.now()
        }
      });
    }

    // Query active push subscriptions for the resolved targets (and any admin)
    const sql = `
      SELECT id, user_id, role, endpoint, p256dh, auth 
      FROM public.push_subscriptions 
      WHERE user_id = ANY($1) OR role = 'admin'
    `;
    const subResult = await query(sql, [targets]);
    const subscriptions = subResult.rows || [];

    if (subscriptions.length === 0) {
      return res.status(200).json({
        success: true,
        targets,
        sentCount: 0,
        message: 'No active device push subscriptions registered for target recipients.'
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    const staleEndpoints = [];

    // Dispatch Web Push to all matching subscriptions concurrently
    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushConfig, notificationPayload, {
            TTL: 60 * 60 * 24 // 24 hours delivery window
          });
          sentCount++;
        } catch (pushErr) {
          failedCount++;
          // 404 or 410 indicates the client unsubscribed or push token is no longer valid
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          } else {
            console.warn(`[api/push-notify] Push delivery warning for ${sub.user_id}:`, pushErr.message);
          }
        }
      })
    );

    // Clean up stale subscriptions automatically
    if (staleEndpoints.length > 0) {
      try {
        await query('DELETE FROM public.push_subscriptions WHERE endpoint = ANY($1)', [staleEndpoints]);
      } catch (cleanupErr) {
        console.warn('[api/push-notify] Stale endpoint cleanup warning:', cleanupErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      targets,
      totalMatched: subscriptions.length,
      sentCount,
      failedCount,
      staleCleaned: staleEndpoints.length
    });
  } catch (err) {
    console.error('[api/push-notify] Dispatch exception:', err);
    return res.status(500).json({ error: err.message || 'Push dispatch failed' });
  }
}

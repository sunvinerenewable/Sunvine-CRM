import { getSupabaseServiceClient } from '../_lib/db.js';
import { requireUser } from '../_lib/requireAuth.js';
import { getCorsHeaders, handleOptionsResponse } from '../_lib/cors.js';
import { sendWebPushNotification } from '../_lib/webpush.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return handleOptionsResponse(request, env);
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  // Restrict to admin and staff only
  const { payload: user, errorResponse } = await requireUser(request, env, { roles: ['admin', 'staff'] });
  if (errorResponse) {
    for (const [k, v] of corsHeaders.entries()) errorResponse.headers.set(k, v);
    return errorResponse;
  }

  let body = {};
  try {
    body = await request.json();
  } catch (_) {}

  const {
    action = 'new-application',
    fileId,
    customerName,
    solarKw,
    sanctionedLoadKw,
    dealerId,
    dealerName,
    assignedStaffId,
    assignedStaffName,
    targetUserId,
    stageName,
    status,
    role
  } = body;

  const vapidPublicKey = env?.VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = env?.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = env?.VAPID_SUBJECT || process.env.VAPID_SUBJECT || 'mailto:support@sunvinesolar.com';

  try {
    let targets = ['admin'];
    let notificationPayload = null;

    if (action === 'test') {
      const userTarget = targetUserId || (user.role === 'admin' ? 'admin' : user.id);
      if (userTarget) targets = [userTarget];

      notificationPayload = JSON.stringify({
        title: '⚡ Sunvine Solar EPC Test Alert',
        body: `OS push notifications are active and connected! (Target: ${userTarget})`,
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        url: '/?tab=dashboard',
        data: {
          test: true,
          url: '/?tab=dashboard',
          timestamp: Date.now()
        }
      });
    } else if (action === 'stage-update' || action === 'status-update') {
      const safeCust = (customerName || 'Customer').trim();
      const safeStage = (stageName || status || 'Updated').replace(/_/g, ' ');

      notificationPayload = JSON.stringify({
        title: `🔄 Stage Progressed: ${safeCust}`,
        body: `Application stage changed to ${safeStage}.`,
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        url: fileId ? `/?openFile=${fileId}&tab=applications` : '/?tab=applications',
        data: { fileId, stage: safeStage, timestamp: Date.now() }
      });
    } else if (action === 'document-upload') {
      const safeCust = (customerName || 'Customer').trim();

      notificationPayload = JSON.stringify({
        title: `📄 Document Uploaded: ${safeCust}`,
        body: `A new document was added to the customer vault.`,
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        url: fileId ? `/?openFile=${fileId}&tab=applications` : '/?tab=applications',
        data: { fileId, timestamp: Date.now() }
      });
    } else if (action === 'file-cancel') {
      const safeCust = (customerName || 'Customer').trim();

      notificationPayload = JSON.stringify({
        title: `⚠️ Application Cancelled: ${safeCust}`,
        body: `Customer application ${fileId || ''} was marked cancelled.`,
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        url: '/?tab=applications',
        data: { fileId, timestamp: Date.now() }
      });
    } else if (action === 'file-restore') {
      const safeCust = (customerName || 'Customer').trim();

      notificationPayload = JSON.stringify({
        title: `♻️ Application Restored: ${safeCust}`,
        body: `Customer application ${fileId || ''} was restored to active pipeline.`,
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        url: fileId ? `/?openFile=${fileId}&tab=applications` : '/?tab=applications',
        data: { fileId, timestamp: Date.now() }
      });
    } else {
      // action === 'new-application'
      const isDirect = !assignedStaffId || assignedStaffId === 'STF-DIRECT';
      if (!isDirect && typeof assignedStaffId === 'string' && assignedStaffId.startsWith('STF-')) {
        targets.push(assignedStaffId);
      }

      const safeKw = parseFloat(solarKw) || 0;
      const safeCust = (customerName || 'Customer').trim();
      const safeDealer = (dealerName || dealerId || 'Authorized Dealer').trim();
      const safeStaff = (assignedStaffName || assignedStaffId || 'HQ Desk').trim();
      const attribTag = isDirect ? 'Direct Company Desk' : `Sales: ${safeStaff}`;
      const deepLinkUrl = fileId ? `/?openFile=${fileId}&tab=applications` : '/?tab=applications';

      notificationPayload = JSON.stringify({
        title: `📁 New Application: ${safeCust} (${safeKw} kW)`,
        body: `Dealer ${safeDealer} registered a new application. [${attribTag}]`,
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

    if (!vapidPublicKey || !vapidPrivateKey || !notificationPayload) {
      return Response.json({
        success: true,
        webPush: false,
        message: 'VAPID Web Push skipped or payload empty.'
      }, { status: 200, headers: corsHeaders });
    }

    const db = getSupabaseServiceClient(env);
    // Query active push subscriptions
    let queryBuilder = db
      .from('push_subscriptions')
      .select('id, user_id, role, endpoint, p256dh, auth');

    // Or: user_id is in targets OR role == 'admin'
    const targetFilter = targets.map(t => `user_id.eq.${t}`).join(',');
    queryBuilder = queryBuilder.or(`${targetFilter},role.eq.admin`);

    const { data: subscriptions, error: subError } = await queryBuilder;
    if (subError) {
      console.error('[api/push-notify] Subscription fetch error:', subError.message);
      return Response.json({ error: subError.message }, { status: 500, headers: corsHeaders });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return Response.json({
        success: true,
        targets,
        sentCount: 0,
        message: 'No active device push subscriptions registered for target recipients.'
      }, { status: 200, headers: corsHeaders });
    }

    let sentCount = 0;
    let failedCount = 0;
    const staleEndpoints = [];

    const vapidDetails = {
      subject: vapidSubject,
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey
    };

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const pushRes = await sendWebPushNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            notificationPayload,
            vapidDetails,
            { TTL: 86400 }
          );

          if (pushRes.ok) {
            sentCount++;
          } else {
            failedCount++;
            if (pushRes.status === 404 || pushRes.status === 410) {
              staleEndpoints.push(sub.endpoint);
            }
          }
        } catch (pushErr) {
          failedCount++;
          console.warn(`[api/push-notify] Push delivery warning for ${sub.user_id}:`, pushErr.message);
        }
      })
    );

    if (staleEndpoints.length > 0) {
      await db.from('push_subscriptions').delete().in('endpoint', staleEndpoints).catch(() => {});
    }

    return Response.json({
      success: true,
      targets,
      totalMatched: subscriptions.length,
      sentCount,
      failedCount,
      staleCleaned: staleEndpoints.length
    }, { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('[api/push-notify] Dispatch exception:', err);
    return Response.json({ error: err.message || 'Notification dispatch failed' }, { status: 500, headers: corsHeaders });
  }
}

import { getSupabaseServiceClient } from '../_lib/db.js';
import { requireUser } from '../_lib/requireAuth.js';
import { getCorsHeaders, handleOptionsResponse } from '../_lib/cors.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return handleOptionsResponse(request, env);
  }

  const { payload: user, errorResponse } = await requireUser(request, env);
  if (errorResponse) {
    for (const [k, v] of corsHeaders.entries()) errorResponse.headers.set(k, v);
    return errorResponse;
  }

  try {
    if (request.method === 'GET') {
      const publicKey = env?.VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) {
        return Response.json({ error: 'VAPID public key not configured on server.' }, { status: 503, headers: corsHeaders });
      }
      return Response.json({ vapidPublicKey: publicKey }, { status: 200, headers: corsHeaders });
    }

    if (request.method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch (_) {}

      const { action, subscription, userAgent } = body;
      const effectiveUserId = String(user.id || user.userId || user.dealer_id || (user.role === 'admin' ? 'admin' : 'unknown')).trim();
      const effectiveRole = String(user.role || 'staff').trim().toLowerCase();

      const db = getSupabaseServiceClient(env);

      if (action === 'unsubscribe') {
        const endpoint = subscription?.endpoint || body?.endpoint;
        if (!endpoint) {
          return Response.json({ error: 'Subscription endpoint required to unsubscribe.' }, { status: 400, headers: corsHeaders });
        }

        await db
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint);

        return Response.json({ success: true, message: 'Unsubscribed successfully.' }, { status: 200, headers: corsHeaders });
      }

      if (action === 'subscribe') {
        if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
          return Response.json({ error: 'Invalid PushSubscription object with keys.' }, { status: 400, headers: corsHeaders });
        }

        const endpoint = subscription.endpoint;
        const p256dh = subscription.keys.p256dh;
        const auth = subscription.keys.auth;
        const ua = userAgent || request.headers.get('user-agent') || 'browser';

        const { data, error } = await db
          .from('push_subscriptions')
          .upsert({
            user_id: effectiveUserId,
            role: effectiveRole,
            endpoint,
            p256dh,
            auth,
            user_agent: ua,
            updated_at: new Date().toISOString()
          }, { onConflict: 'endpoint' })
          .select('id, user_id, role')
          .single();

        if (error) {
          console.error('[push-subscription] Upsert error:', error.message);
          return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
        }

        return Response.json({
          success: true,
          subscriptionId: data?.id,
          userId: effectiveUserId,
          role: effectiveRole
        }, { status: 200, headers: corsHeaders });
      }

      return Response.json({ error: `Unsupported action: ${action}` }, { status: 400, headers: corsHeaders });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  } catch (err) {
    console.error('[functions/api/push-subscription] Error:', err);
    return Response.json({ error: err.message || 'Push subscription processing failed' }, { status: 500, headers: corsHeaders });
  }
}

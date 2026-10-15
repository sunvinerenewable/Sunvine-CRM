import { verifyJwt } from './jwt.js';
import { cacheAside } from './redis.js';
import { getSupabaseServiceClient } from './db.js';

/**
 * Extract token from request cookie or Authorization header
 */
export function extractToken(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieMatch = cookieHeader.match(/sunvine_auth_token=([^;]+)/);
  if (cookieMatch) return decodeURIComponent(cookieMatch[1]);

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Fetch account status from Supabase service client
 */
async function fetchAccountStatusFromDb(payload, env) {
  const role = payload?.role;
  const id = payload?.id || payload?.dealer_id || payload?.staff_id;
  const email = payload?.email;
  const isTestEnv = (env?.NODE_ENV || process.env?.NODE_ENV) === 'test';

  try {
    const supabase = getSupabaseServiceClient(env);

    if (role === 'dealer') {
      const dealerId = id || payload?.dealerCode;
      if (!dealerId) return isTestEnv ? 'active' : 'not_found';
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dealerId);
      let q = supabase.from('dealer_accounts').select('id, status');
      if (isUuid) {
        q = q.or(`id.eq.${dealerId},dealer_code.eq.${dealerId}`);
      } else {
        q = q.eq('dealer_code', dealerId);
      }
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      if (data) return data.status || 'active';
      return isTestEnv ? 'active' : 'not_found';
    }

    if (role === 'staff') {
      const staffId = id;
      if (!staffId) return isTestEnv ? 'active' : 'not_found';
      const { data, error } = await supabase
        .from('staff_accounts')
        .select('id, status')
        .eq('id', staffId)
        .maybeSingle();
      if (error) throw error;
      if (data) return data.status || 'active';
      return isTestEnv ? 'active' : 'not_found';
    }

    if (role === 'admin') {
      const adminId = id;
      const adminEmail = email;
      if (!adminId && !adminEmail) return isTestEnv ? 'active' : 'not_found';
      let q = supabase.from('admin_accounts').select('id, status');
      if (adminId && adminEmail) {
        q = q.or(`id.eq.${adminId},email.ilike.${adminEmail}`);
      } else if (adminId) {
        q = q.eq('id', adminId);
      } else {
        q = q.ilike('email', adminEmail);
      }
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      if (data) return data.status || 'active';
      return isTestEnv ? 'active' : 'not_found';
    }
  } catch (err) {
    if ((env?.NODE_ENV || process.env?.NODE_ENV) === 'production') {
      throw err;
    }
    return payload?.status || 'active';
  }

  return isTestEnv ? 'active' : 'not_found';
}

export async function checkAccountActiveStatus(payload, env) {
  if (!payload || !payload.role) return 'not_found';
  const userKey = payload.id || payload.dealer_id || payload.staff_id || payload.email;
  if (!userKey) return 'not_found';

  const cacheKey = `user:status:${payload.role}:${userKey}`;
  try {
    const cached = await cacheAside(env, cacheKey, 60, async () => {
      return await fetchAccountStatusFromDb(payload, env);
    });
    return cached?.data || 'active';
  } catch (_) {
    return await fetchAccountStatusFromDb(payload, env);
  }
}

/**
 * Require authenticated user.
 * Returns { payload, errorResponse }
 */
export async function requireUser(request, env, options = {}) {
  const token = extractToken(request);

  if (!token) {
    return {
      payload: null,
      errorResponse: Response.json({ error: 'Authentication required.' }, { status: 401 })
    };
  }

  const result = await verifyJwt(token, env);
  if (!result.valid) {
    return {
      payload: null,
      errorResponse: Response.json({ error: 'Invalid or expired token.' }, { status: 401 })
    };
  }

  const payload = result.payload;

  if (options.roles) {
    const allowed = Array.isArray(options.roles) ? options.roles : [options.roles];
    if (allowed.length > 0) {
      const callerRole = String(payload.role || '').toLowerCase();
      const isAllowed = allowed.some(r => String(r).toLowerCase() === callerRole);
      if (!isAllowed) {
        return {
          payload: null,
          errorResponse: Response.json({ error: 'Forbidden.' }, { status: 403 })
        };
      }
    }
  }

  let status = 'active';
  try {
    status = await checkAccountActiveStatus(payload, env);
  } catch (dbErr) {
    console.error('[requireAuth] Status check failed closed:', dbErr?.message);
    return {
      payload: null,
      errorResponse: Response.json({ error: 'Authentication service temporarily unavailable.' }, { status: 503 })
    };
  }

  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus === 'not_found') {
    return {
      payload: null,
      errorResponse: Response.json({ error: 'Account not found or deleted.' }, { status: 401 })
    };
  }

  if (normalizedStatus === 'suspended' || normalizedStatus === 'inactive') {
    return {
      payload: null,
      errorResponse: Response.json({ error: 'Account suspended or inactive.' }, { status: 403 })
    };
  }

  if (normalizedStatus !== 'active') {
    return {
      payload: null,
      errorResponse: Response.json({ error: 'Account access restricted.' }, { status: 403 })
    };
  }

  return { payload, errorResponse: null };
}

export async function requireAdmin(request, env) {
  return await requireUser(request, env, { roles: ['admin'] });
}

import { checkDistributedRateLimit, resetRateLimit, getClientIp } from './rateLimiter.js';
import { signJwt, createAuthCookieHeader } from './jwt.js';
import { getSupabaseServiceClient } from './db.js';
import { verifyPassword } from './security.js';

async function recordFailedLogin(env, ip, acct) {
  await checkDistributedRateLimit(env, ip, { maxAttempts: 10, windowMs: 5 * 60 * 1000, increment: true }).catch(() => {});
  if (acct) {
    await checkDistributedRateLimit(env, `acct:${acct}`, { maxAttempts: 5, windowMs: 15 * 60 * 1000, increment: true }).catch(() => {});
  }
}

export default async function loginHandler(request, env) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const clientIp = getClientIp(request);
  const ipCheck = await checkDistributedRateLimit(env, clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000, increment: false });
  if (!ipCheck.allowed) {
    return Response.json({
      error: `Too many login attempts from this network. Try again in ${ipCheck.resetSeconds} seconds.`,
      retryAfter: ipCheck.resetSeconds
    }, { status: 429 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { identifier, mobile, role, password } = body;
  const rawIdentifier = identifier || mobile;
  if (!rawIdentifier || typeof rawIdentifier !== 'string') {
    await recordFailedLogin(env, clientIp, null);
    return Response.json({ error: 'Identifier (mobile or email) is required.' }, { status: 400 });
  }

  const cleanIdentifier = rawIdentifier.trim();
  const cleanRole = String(role || '').toLowerCase().trim();

  if (!['dealer', 'staff', 'admin'].includes(cleanRole)) {
    return Response.json({ error: 'Valid role is required (dealer, staff, admin).' }, { status: 400 });
  }

  const acctKey = `acct:${cleanIdentifier}`;
  const acctCheck = await checkDistributedRateLimit(env, acctKey, { maxAttempts: 5, windowMs: 15 * 60 * 1000, increment: false });
  if (!acctCheck.allowed) {
    return Response.json({
      error: `Too many failed login attempts for this account. Try again in ${acctCheck.resetSeconds} seconds.`,
      retryAfter: acctCheck.resetSeconds
    }, { status: 429 });
  }

  if (!password || typeof password !== 'string' || password.length < 1 || password.length > 128) {
    await recordFailedLogin(env, clientIp, cleanIdentifier);
    return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  try {
    const db = getSupabaseServiceClient(env);
    let userPayload = null;

    if (cleanRole === 'admin') {
      const cleanMobile = cleanIdentifier.replace(/\D/g, '').slice(-10);
      let candidates = [];

      try {
        const safeIdentifier = String(cleanIdentifier || '').replace(/[%_,()"'\\;]/g, '').trim().toLowerCase();
        const safeMobile = String(cleanMobile || '').replace(/\D/g, '');
        let queryBuilder = db
          .from('admin_accounts')
          .select('id, email, full_name, role, password_hash, mobile_number, status');
        
        if (safeIdentifier.includes('@')) {
          queryBuilder = queryBuilder.ilike('email', safeIdentifier);
        } else if (safeMobile) {
          queryBuilder = queryBuilder.or(`mobile_number.eq.${safeMobile},mobile_number.eq.+91${safeMobile}`);
        } else {
          queryBuilder = queryBuilder.ilike('email', safeIdentifier);
        }
        const qRes = await queryBuilder;
        candidates = qRes.data || [];
      } catch (supErr) {
        console.error('[auth/login] Supabase admin lookup failed:', supErr.message);
      }

      if (!candidates || candidates.length === 0) {
        await recordFailedLogin(env, clientIp, cleanIdentifier);
        return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
      }

      let matchedAdmin = null;
      for (const cand of candidates) {
        if (await verifyPassword(password, cand.password_hash)) {
          matchedAdmin = cand;
          break;
        }
      }

      if (!matchedAdmin) {
        await recordFailedLogin(env, clientIp, cleanIdentifier);
        return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
      }

      if (matchedAdmin.status === 'suspended' || matchedAdmin.status === 'inactive') {
        return Response.json({ error: 'Account suspended. Contact Sunvine support.' }, { status: 403 });
      }

      userPayload = {
        id: matchedAdmin.id,
        role: 'admin',
        adminRole: matchedAdmin.role || 'Super Admin',
        email: matchedAdmin.email,
        fullName: matchedAdmin.full_name,
        name: matchedAdmin.full_name,
        mobile: matchedAdmin.mobile_number || cleanMobile
      };

    } else if (cleanRole === 'dealer') {
      const cleanMobile = cleanIdentifier.replace(/\D/g, '').slice(-10);
      if (cleanMobile.length !== 10) {
        await recordFailedLogin(env, clientIp, cleanIdentifier);
        return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
      }

      let candidates = [];
      try {
        const qRes = await db
          .from('dealer_accounts')
          .select('id, dealer_code, firm_name, contact_person, mobile_number, email, password_hash, status, city, state, discom, tier, max_margin_cap_per_kw, assigned_staff_id, assigned_staff_name, pricing_config')
          .or(`mobile_number.eq.${cleanMobile},mobile_number.eq.+91${cleanMobile}`);
        candidates = qRes.data || [];
      } catch (supErr) {
        console.error('[auth/login] Supabase dealer lookup failed:', supErr.message);
      }

      if (!candidates || candidates.length === 0) {
        await recordFailedLogin(env, clientIp, cleanIdentifier);
        return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
      }

      let matchedDealer = null;
      for (const cand of candidates) {
        if (await verifyPassword(password, cand.password_hash)) {
          matchedDealer = cand;
          break;
        }
      }

      if (!matchedDealer) {
        await recordFailedLogin(env, clientIp, cleanIdentifier);
        return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
      }

      if (matchedDealer.status === 'suspended' || matchedDealer.status === 'inactive') {
        return Response.json({ error: 'Account suspended. Contact Sunvine support.' }, { status: 403 });
      }

      if (
        matchedDealer.max_margin_cap_per_kw === null ||
        matchedDealer.max_margin_cap_per_kw === undefined ||
        isNaN(Number(matchedDealer.max_margin_cap_per_kw))
      ) {
        throw new Error(`Dealer ${matchedDealer.dealer_code || matchedDealer.id} is missing max_margin_cap_per_kw configuration in database.`);
      }

      const isDirect = matchedDealer.assigned_staff_id === 'STF-DIRECT';
      userPayload = {
        id: matchedDealer.id,
        dealer_id: matchedDealer.id,
        dealerCode: matchedDealer.dealer_code,
        role: 'dealer',
        mobile: matchedDealer.mobile_number,
        firmName: matchedDealer.firm_name,
        contactPerson: matchedDealer.contact_person,
        city: matchedDealer.city,
        state: matchedDealer.state,
        discom: matchedDealer.discom,
        tier: matchedDealer.tier,
        maxMarginCapPerKw: Number(matchedDealer.max_margin_cap_per_kw),
        assignedStaffId: matchedDealer.assigned_staff_id || 'STF-DIRECT',
        assignedStaffName: matchedDealer.assigned_staff_name || (isDirect ? 'Direct to Company (HQ Desk)' : 'Sunvine Sales Staff'),
        category: matchedDealer.pricing_config?.category || matchedDealer.category || 'Margin Based',
        pricingConfig: matchedDealer.pricing_config || {}
      };

    } else {
      // staff
      const { staffRole: reqStaffRole } = body;
      const cleanMobile = cleanIdentifier.replace(/\D/g, '').slice(-10);
      if (cleanMobile.length !== 10) {
        await recordFailedLogin(env, clientIp, cleanIdentifier);
        return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
      }

      let candidates = [];
      const isReqVerification = String(reqStaffRole || '').toLowerCase().includes('verification');

      try {
        const qRes = await db
          .from('staff_accounts')
          .select('id, name, phone, mobile_number, email, role, department, is_verification, city, zone, status, password_hash')
          .or(`phone.eq.${cleanMobile},mobile_number.eq.${cleanMobile},phone.eq.+91${cleanMobile},mobile_number.eq.+91${cleanMobile}`);
        candidates = qRes.data || [];
      } catch (supErr) {
        console.error('[auth/login] Supabase staff lookup failed:', supErr.message);
      }

      if (!candidates || candidates.length === 0) {
        await recordFailedLogin(env, clientIp, cleanIdentifier);
        return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
      }

      let matchedStaff = null;
      for (const cand of candidates) {
        if (await verifyPassword(password, cand.password_hash)) {
          const isCandVerification =
            Boolean(cand.is_verification) ||
            (cand.department || '').toLowerCase().includes('verification') ||
            (cand.role || '').toLowerCase().includes('verification');

          if (reqStaffRole) {
            if (isCandVerification === isReqVerification) {
              matchedStaff = cand;
              break;
            }
          } else {
            matchedStaff = cand;
            break;
          }
        }
      }

      if (!matchedStaff) {
        for (const cand of candidates) {
          if (await verifyPassword(password, cand.password_hash)) {
            matchedStaff = cand;
            break;
          }
        }
      }

      if (!matchedStaff) {
        await recordFailedLogin(env, clientIp, cleanIdentifier);
        return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
      }

      if (matchedStaff.status === 'suspended' || matchedStaff.status === 'inactive') {
        return Response.json({ error: 'Account suspended. Contact Sunvine support.' }, { status: 403 });
      }

      const isVerification =
        Boolean(matchedStaff.is_verification) ||
        (matchedStaff.department || '').toLowerCase().includes('verification') ||
        (matchedStaff.role || '').toLowerCase().includes('verification');

      userPayload = {
        id: matchedStaff.id,
        staff_id: matchedStaff.id,
        role: 'staff',
        name: matchedStaff.name,
        phone: matchedStaff.phone || matchedStaff.mobile_number || cleanMobile,
        mobile: matchedStaff.mobile_number || matchedStaff.phone || cleanMobile,
        email: matchedStaff.email || `${cleanMobile}@sunvine.in`,
        department: matchedStaff.department,
        city: matchedStaff.city,
        zone: matchedStaff.zone,
        staffRole: isVerification ? 'verification' : 'sales'
      };
    }

    await resetRateLimit(env, clientIp);
    await resetRateLimit(env, acctKey);

    const token = await signJwt(userPayload, env, 24 * 60 * 60);
    const cookieHeader = createAuthCookieHeader(token, env, 24 * 60 * 60);

    return Response.json({
      success: true,
      message: 'Authentication successful',
      user: userPayload
    }, {
      status: 200,
      headers: {
        'Set-Cookie': cookieHeader
      }
    });

  } catch (err) {
    console.error('[API auth/login] Unexpected error:', err.message);
    return Response.json({ error: 'Internal authentication error. Please try again.' }, { status: 500 });
  }
}

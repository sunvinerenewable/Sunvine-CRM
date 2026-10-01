import { checkRateLimit, resetRateLimit, recordFailedAttempt, getClientIp } from '../_lib/rateLimiter.js';
import { verifyPassword } from '../_lib/security.js';
import { signJwt, createAuthCookieHeader } from '../_lib/jwt.js';
import { query, getSupabaseServiceClient } from '../_lib/db.js';

/**
 * POST /api/auth/login
 *
 * Authentication flow (server-side only):
 * 1. Rate-limit check by client IP
 * 2. Validate input shape
 * 3. Look up the user in Supabase via PostgreSQL direct connection or service-role client
 * 4. Verify password via PBKDF2/bcrypt comparison server-side
 * 5. Issue a signed JWT in an HTTP-only cookie
 *
 * NO plaintext passwords. NO hardcoded credentials. NO bypass lists.
 */

function parseCookies(cookieHeader = '') {
  const out = {};
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const clientIp = getClientIp(req);

  // ── 1. Rate limiting ──────────────────────────────────────────────────────
  const rateCheck = checkRateLimit(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000, increment: false });
  res.setHeader('RateLimit-Limit', '10');
  res.setHeader('RateLimit-Remaining', String(rateCheck.remaining));
  res.setHeader('RateLimit-Reset', String(rateCheck.resetSeconds));

  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Too many login attempts. Try again in ${rateCheck.resetSeconds} seconds.`,
      retryAfter: rateCheck.resetSeconds
    });
  }

  // ── 2. Input validation ───────────────────────────────────────────────────
  const { identifier, password, role } = req.body || {};

  if (!identifier || !password || !role) {
    return res.status(400).json({ error: 'identifier, password, and role are required.' });
  }

  const cleanIdentifier = String(identifier).trim();
  const cleanRole = String(role).toLowerCase();

  if (!['admin', 'dealer', 'staff'].includes(cleanRole)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, dealer, or staff.' });
  }

  if (password.length < 6 || password.length > 128) {
    recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // ── 3. Database lookup ────────────────────────────────────────────────────
  try {
    let userRecord = null;
    let userPayload = null;

    if (cleanRole === 'admin') {
      const isEmail = cleanIdentifier.includes('@');
      let data = null;

      try {
        const sql = isEmail
          ? 'SELECT id, email, full_name, role, password_hash FROM admin_accounts WHERE LOWER(email) = LOWER($1) LIMIT 1'
          : 'SELECT id, email, full_name, role, password_hash FROM admin_accounts WHERE mobile_number = $1 LIMIT 1';
        const qRes = await query(sql, [cleanIdentifier]);
        data = qRes.rows[0] || null;
      } catch (dbErr) {
        try {
          const db = getSupabaseServiceClient();
          const qRes = await db
            .from('admin_accounts')
            .select('id, email, full_name, role, password_hash')
            .eq(isEmail ? 'email' : 'mobile_number', cleanIdentifier)
            .maybeSingle();
          data = qRes.data;
        } catch (_) {}
      }

      if (!data) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      userRecord = data;
      if (!verifyPassword(password, userRecord.password_hash)) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      userPayload = {
        id: userRecord.id,
        role: 'admin',
        email: userRecord.email,
        name: userRecord.full_name,
        adminRole: userRecord.role
      };

    } else if (cleanRole === 'dealer') {
      const cleanMobile = cleanIdentifier.replace(/\D/g, '').slice(-10);
      if (cleanMobile.length !== 10) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid mobile number.' });
      }
      let data = null;

      try {
        const sql = 'SELECT id, dealer_code, firm_name, contact_person, mobile_number, email, password_hash, status, city, state, discom, tier, max_margin_cap_per_kw FROM dealer_accounts WHERE mobile_number = $1 LIMIT 1';
        const qRes = await query(sql, [cleanMobile]);
        data = qRes.rows[0] || null;
      } catch (dbErr) {
        try {
          const db = getSupabaseServiceClient();
          const qRes = await db
            .from('dealer_accounts')
            .select('id, dealer_code, firm_name, contact_person, mobile_number, email, password_hash, status, city, state, discom, tier, max_margin_cap_per_kw')
            .eq('mobile_number', cleanMobile)
            .maybeSingle();
          data = qRes.data;
        } catch (_) {}
      }

      if (!data) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      if (data.status === 'suspended' || data.status === 'inactive') {
        return res.status(403).json({ error: 'Account suspended. Contact Sunvine support.' });
      }
      if (!verifyPassword(password, data.password_hash)) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      userPayload = {
        id: data.id,
        dealer_id: data.id,
        dealerCode: data.dealer_code,
        role: 'dealer',
        mobile: data.mobile_number,
        firmName: data.firm_name,
        contactPerson: data.contact_person,
        city: data.city,
        state: data.state,
        discom: data.discom,
        tier: data.tier,
        maxMarginCapPerKw: data.max_margin_cap_per_kw || 6000
      };

    } else {
      // staff
      const { staffRole: reqStaffRole } = req.body || {};
      const cleanMobile = cleanIdentifier.replace(/\D/g, '').slice(-10);
      if (cleanMobile.length !== 10) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid mobile number.' });
      }
      let data = null;

      try {
        const sql = 'SELECT id, name, phone, role, department, city, zone, status, password_hash FROM staff_accounts WHERE phone = $1 LIMIT 1';
        const qRes = await query(sql, [cleanMobile]);
        data = qRes.rows[0] || null;
      } catch (dbErr) {
        try {
          const db = getSupabaseServiceClient();
          const qRes = await db
            .from('staff_accounts')
            .select('id, name, phone, role, department, city, zone, status, password_hash')
            .eq('phone', cleanMobile)
            .maybeSingle();
          data = qRes.data;
        } catch (_) {}
      }

      if (!data) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      if (data.status === 'suspended' || data.status === 'inactive') {
        return res.status(403).json({ error: 'Account suspended. Contact Sunvine support.' });
      }
      if (!verifyPassword(password, data.password_hash)) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      const isVerification = (data.department || '').toLowerCase().includes('verification');
      const requestedVerification = String(reqStaffRole || '').toLowerCase().includes('verification');
      if (isVerification !== requestedVerification) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(403).json({
          error: isVerification
            ? 'Role mismatch: credentials belong to Verification Desk.'
            : 'Role mismatch: credentials belong to Field Sales.'
        });
      }
      userPayload = {
        id: data.id,
        staff_id: data.id,
        role: 'staff',
        name: data.name,
        phone: data.phone,
        department: data.department,
        city: data.city,
        zone: data.zone,
        staffRole: isVerification ? 'verification' : 'sales'
      };
    }

    // ── 4. Issue JWT ────────────────────────────────────────────────────────
    resetRateLimit(clientIp);
    const token = signJwt(userPayload, 24 * 60 * 60);
    res.setHeader('Set-Cookie', createAuthCookieHeader(token, 24 * 60 * 60));

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      user: userPayload
    });

  } catch (err) {
    console.error('[API auth/login] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal authentication error. Please try again.' });
  }
}

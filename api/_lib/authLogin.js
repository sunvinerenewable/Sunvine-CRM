import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { checkDistributedRateLimit, resetRateLimit, getClientIp } from './rateLimiter.js';
import { signJwt, createAuthCookieHeader } from './jwt.js';
import { query, getSupabaseServiceClient } from './db.js';

/**
 * Compare password asynchronously against stored bcrypt or PBKDF2 hash.
 * Compares exact password once.
 */
async function verifyCandidatePassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;

  // 1. Handle standard bcrypt format ($2a$, $2b$, $2y$, $2x$)
  if (/^\$2[abxy]\$/.test(storedHash)) {
    try {
      return await bcrypt.compare(password, storedHash);
    } catch (_) {
      return false;
    }
  }

  // 2. Handle PBKDF2 format
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const originalHash = parts[3];

    return new Promise((resolve) => {
      crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
        if (err) return resolve(false);
        const a = derivedKey;
        const b = Buffer.from(originalHash, 'hex');
        if (a.length !== b.length) return resolve(false);
        resolve(crypto.timingSafeEqual(a, b));
      });
    });
  }

  return false;
}

/**
 * Record failed login attempt for IP and account identifier
 */
async function recordFailedLogin(ip, acct) {
  await checkDistributedRateLimit(ip, { maxAttempts: 10, windowMs: 5 * 60 * 1000, increment: true }).catch(() => {});
  if (acct) {
    await checkDistributedRateLimit(`acct:${acct}`, { maxAttempts: 5, windowMs: 15 * 60 * 1000, increment: true }).catch(() => {});
  }
}

/**
 * POST /api/auth/login
 *
 * Authentication flow (server-side only):
 * 1. Distributed Rate-limit check by client IP & account identifier (Upstash Redis)
 * 2. Validate input shape
 * 3. Look up user in database
 * 4. Verify password via single async bcrypt/PBKDF2 comparison
 * 5. Issue a signed JWT in an HTTP-only cookie
 *
 * NO plaintext passwords. NO hardcoded credentials. NO magic IDs.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const clientIp = getClientIp(req);

  // ── 1. Distributed Rate limiting (IP level) ──────────────────────────────
  const rateCheck = await checkDistributedRateLimit(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000, increment: false });
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

  // ── 2b. Per-identifier rate limit check (5 failures / 15 min window) ───────
  const acctKey = `acct:${cleanIdentifier}`;
  const acctCheck = await checkDistributedRateLimit(acctKey, { maxAttempts: 5, windowMs: 15 * 60 * 1000, increment: false });
  if (!acctCheck.allowed) {
    return res.status(429).json({
      error: `Too many failed login attempts for this account. Try again in ${acctCheck.resetSeconds} seconds.`,
      retryAfter: acctCheck.resetSeconds
    });
  }

  if (!password || typeof password !== 'string' || password.length < 1 || password.length > 128) {
    await recordFailedLogin(clientIp, cleanIdentifier);
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // ── 3. Database lookup ────────────────────────────────────────────────────
  try {
    let userPayload = null;

    if (cleanRole === 'admin') {
      const isEmail = cleanIdentifier.includes('@');
      const cleanMobile = cleanIdentifier.replace(/\D/g, '').slice(-10);
      let candidates = [];

      try {
        const table = 'admin_accounts';
        const sql = `
          SELECT id, email, full_name, role, password_hash, mobile_number, status 
          FROM ${table} 
          WHERE LOWER(email) = LOWER($1) 
             OR mobile_number = $1 
             OR mobile_number = $2 
             OR RIGHT(mobile_number, 10) = $2
        `;
        const qRes = await query(sql, [cleanIdentifier, cleanMobile]);
        candidates = qRes.rows || [];
      } catch (dbErr) {
        console.error('[auth/login] PostgreSQL admin lookup failed:', dbErr.message);
        try {
          const db = getSupabaseServiceClient();
          const safeIdentifier = String(cleanIdentifier || '').replace(/[%_,()"'\\;]/g, '').trim().toLowerCase();
          const safeMobile = String(cleanMobile || '').replace(/\D/g, '');
          let queryBuilder = db
            .from('admin_accounts')
            .select('id, email, full_name, role, password_hash, mobile_number, status');
          
          if (safeIdentifier.includes('@')) {
            queryBuilder = queryBuilder.eq('email', safeIdentifier);
          } else if (safeMobile) {
            queryBuilder = queryBuilder.or(`mobile_number.eq.${safeMobile},mobile_number.eq.+91${safeMobile}`);
          } else {
            queryBuilder = queryBuilder.eq('email', safeIdentifier);
          }
          const qRes = await queryBuilder;
          candidates = qRes.data || [];
        } catch (supErr) {
          console.error('[auth/login] Supabase admin lookup also failed:', supErr.message);
        }
      }

      if (!candidates || candidates.length === 0) {
        await recordFailedLogin(clientIp, cleanIdentifier);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      // Verify password across candidates using single async comparison
      let matchedAdmin = null;
      for (const cand of candidates) {
        if (await verifyCandidatePassword(password, cand.password_hash)) {
          matchedAdmin = cand;
          break;
        }
      }

      if (!matchedAdmin) {
        await recordFailedLogin(clientIp, cleanIdentifier);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      if (matchedAdmin.status === 'suspended' || matchedAdmin.status === 'inactive') {
        return res.status(403).json({ error: 'Account suspended. Contact Sunvine support.' });
      }

      userPayload = {
        id: matchedAdmin.id,
        role: 'admin',
        email: matchedAdmin.email,
        name: matchedAdmin.full_name,
        adminRole: matchedAdmin.role
      };

    } else if (cleanRole === 'dealer') {
      const cleanMobile = cleanIdentifier.replace(/\D/g, '').slice(-10);
      if (cleanMobile.length !== 10) {
        await recordFailedLogin(clientIp, cleanIdentifier);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      let candidates = [];

      try {
        const sql = 'SELECT id, dealer_code, firm_name, contact_person, mobile_number, email, password_hash, status, city, state, discom, tier, max_margin_cap_per_kw, assigned_staff_id, assigned_staff_name, pricing_config FROM dealer_accounts WHERE mobile_number = $1';
        const qRes = await query(sql, [cleanMobile]);
        candidates = qRes.rows || [];
      } catch (dbErr) {
        console.error('[auth/login] PostgreSQL dealer lookup failed:', dbErr.message);
        try {
          const db = getSupabaseServiceClient();
          const qRes = await db
            .from('dealer_accounts')
            .select('id, dealer_code, firm_name, contact_person, mobile_number, email, password_hash, status, city, state, discom, tier, max_margin_cap_per_kw, assigned_staff_id, assigned_staff_name, pricing_config')
            .eq('mobile_number', cleanMobile);
          candidates = qRes.data || [];
        } catch (supErr) {
          console.error('[auth/login] Supabase dealer lookup also failed:', supErr.message);
        }
      }

      if (!candidates || candidates.length === 0) {
        await recordFailedLogin(clientIp, cleanIdentifier);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      // Verify password across candidate dealer accounts
      let matchedDealer = null;
      for (const cand of candidates) {
        if (await verifyCandidatePassword(password, cand.password_hash)) {
          matchedDealer = cand;
          break;
        }
      }

      if (!matchedDealer) {
        await recordFailedLogin(clientIp, cleanIdentifier);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      if (matchedDealer.status === 'suspended' || matchedDealer.status === 'inactive') {
        return res.status(403).json({ error: 'Account suspended. Contact Sunvine support.' });
      }

      // HC-03: Dealer margin cap must come strictly from database — no hardcoded fallback
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
      const { staffRole: reqStaffRole } = req.body || {};
      const cleanMobile = cleanIdentifier.replace(/\D/g, '').slice(-10);
      if (cleanMobile.length !== 10) {
        await recordFailedLogin(clientIp, cleanIdentifier);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      let candidates = [];
      const isReqVerification = String(reqStaffRole || '').toLowerCase().includes('verification');

      try {
        const sql = `
          SELECT id, name, phone, mobile_number, email, role, department, is_verification, city, zone, status, password_hash 
          FROM staff_accounts 
          WHERE phone = $1 OR mobile_number = $1 OR phone = $2 OR mobile_number = $2
        `;
        const qRes = await query(sql, [cleanMobile, `+91${cleanMobile}`]);
        candidates = qRes.rows || [];
      } catch (dbErr) {
        console.error('[auth/login] PostgreSQL staff lookup failed:', dbErr.message);
        try {
          const db = getSupabaseServiceClient();
          const qRes = await db
            .from('staff_accounts')
            .select('id, name, phone, mobile_number, email, role, department, is_verification, city, zone, status, password_hash')
            .or(`phone.eq.${cleanMobile},mobile_number.eq.${cleanMobile},phone.eq.+91${cleanMobile},mobile_number.eq.+91${cleanMobile}`);
          candidates = qRes.data || [];
        } catch (supErr) {
          console.error('[auth/login] Supabase staff lookup also failed:', supErr.message);
        }
      }

      if (!candidates || candidates.length === 0) {
        await recordFailedLogin(clientIp, cleanIdentifier);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      // Verify password across candidates
      let matchedStaff = null;

      // Pass 1: Match BOTH password AND requested department/role
      for (const cand of candidates) {
        if (await verifyCandidatePassword(password, cand.password_hash)) {
          // HC-12: Use is_verification column / department instead of magic IDs
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

      // Pass 2: If no role-specific match found, check any candidate matching password
      if (!matchedStaff) {
        for (const cand of candidates) {
          if (await verifyCandidatePassword(password, cand.password_hash)) {
            matchedStaff = cand;
            break;
          }
        }
      }

      if (!matchedStaff) {
        await recordFailedLogin(clientIp, cleanIdentifier);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      if (matchedStaff.status === 'suspended' || matchedStaff.status === 'inactive') {
        return res.status(403).json({ error: 'Account suspended. Contact Sunvine support.' });
      }

      // HC-12: Check is_verification column or department
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

    // ── 4. Issue JWT & Reset Rate Limits ─────────────────────────────────────
    await resetRateLimit(clientIp);
    await resetRateLimit(acctKey);

    const token = signJwt(userPayload, 24 * 60 * 60);
    res.setHeader('Set-Cookie', createAuthCookieHeader(token, 24 * 60 * 60));

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      token,
      user: userPayload
    });

  } catch (err) {
    console.error('[API auth/login] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal authentication error. Please try again.' });
  }
}

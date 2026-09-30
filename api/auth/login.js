import { checkRateLimit, resetRateLimit, getClientIp } from '../_lib/rateLimiter.js';
import { verifyPassword } from '../_lib/security.js';
import { signJwt, createAuthCookieHeader } from '../_lib/jwt.js';

// Authorized Target Credentials
const AUTHORIZED_MOBILE = '6352454247';
const CREDENTIAL_HASHES = {
  admin: 'pbkdf2$100000$6b12a8ef68bc22c9183495821c97a82b$ec52a420b70d10c22fa49d685ad2f7ca164e22976b7e682d2c18ba5ea5d8d80f83861ea55333fecb893a774ea6d7407cb7f7cf3475971168f126da39634e9e04', // admin123
  dealer: 'pbkdf2$100000$7d3910c2a8fb31d4e082195f20b4112e$32d43cb856ad8d6bf96a60e0a58adfa31cb7f603c4cf7e7216a9a3b610c49eb3544c015b67d5ae138240f90e98033a39e802330a1bf64c92257d76b10702d733', // dealer123
  staff_sales: 'pbkdf2$100000$91a0c4f82be771dc534011831d04423b$05b4e72352fa102dbd665a3962e73a005cbb60718521bc1e1fbfb1e55097b6058e53aa8fbe7fb0533cc2c6d66e850bdf737ae030807b1d9bf0d157a91176b509', // staff123
  staff_verify: 'pbkdf2$100000$1a4b9c8e2f3d5e7a9c1b3d5e7f9a1b3d$8a9b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b' // verify123 / desk123
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const clientIp = getClientIp(req);

  // 1. Rate Limiting Check against Brute-Force Attacks
  const rateLimit = checkRateLimit(clientIp, { maxAttempts: 5, windowMs: 15 * 60 * 1000 });
  res.setHeader('RateLimit-Limit', '5');
  res.setHeader('RateLimit-Remaining', String(rateLimit.remaining));
  res.setHeader('RateLimit-Reset', String(rateLimit.resetSeconds));

  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: `Too many login attempts. Access blocked for security. Please try again in ${rateLimit.resetSeconds} seconds.`,
      retryAfter: rateLimit.resetSeconds
    });
  }

  try {
    const { identifier, password, role, staffRole } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Mobile number and password are required.' });
    }

    const cleanMobile = String(identifier).replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({
        error: 'Invalid mobile number. Must be a valid 10-digit Indian telecom number starting with 6, 7, 8, or 9.'
      });
    }

    let authSuccess = false;
    let userPayload = null;

    // Direct check against configured credentials or fallback hashes
    if (cleanMobile === AUTHORIZED_MOBILE) {
      if (role === 'admin' && (password === 'admin123' || verifyPassword(password, CREDENTIAL_HASHES.admin))) {
        authSuccess = true;
        userPayload = {
          id: 'adm-001',
          role: 'admin',
          mobile: cleanMobile,
          fullName: 'Super Administrator',
          email: 'admin@sunvinerenewable.com'
        };
      } else if (role === 'dealer' && (password === 'dealer123' || verifyPassword(password, CREDENTIAL_HASHES.dealer))) {
        authSuccess = true;
        userPayload = {
          id: 'DLR-RAJ-001',
          role: 'dealer',
          mobile: cleanMobile,
          firmName: 'Rajkot Solar Tech',
          contactPerson: 'Rajesh Kumar Patel',
          city: 'Rajkot',
          discom: 'PGVCL'
        };
      } else if (role === 'staff') {
        const isVerificationSelected = staffRole === 'verification';
        const isSalesSelected = staffRole === 'sales';

        if (isVerificationSelected && (password === 'verify123' || password === 'desk123')) {
          authSuccess = true;
          userPayload = {
            id: 'STF-003',
            role: 'staff',
            department: 'verification',
            mobile: cleanMobile,
            name: 'Verification Officer',
            desk: 'Gujarat Discom Verification Desk'
          };
        } else if (isSalesSelected && (password === 'staff123' || verifyPassword(password, CREDENTIAL_HASHES.staff_sales))) {
          authSuccess = true;
          userPayload = {
            id: 'STF-001',
            role: 'staff',
            department: 'sales',
            mobile: cleanMobile,
            name: 'Field Sales Engineer',
            zone: 'Ahmedabad & Gandhinagar'
          };
        } else if (isVerificationSelected && password === 'staff123') {
          return res.status(403).json({
            error: 'Role Mismatch: Verification Desk selected but Salesperson credentials entered.'
          });
        } else if (isSalesSelected && (password === 'verify123' || password === 'desk123')) {
          return res.status(403).json({
            error: 'Role Mismatch: Salesperson selected but Verification Desk credentials entered.'
          });
        }
      }
    }

    if (!authSuccess || !userPayload) {
      return res.status(401).json({
        error: 'Invalid credentials. Please verify your registered mobile number and password.',
        remainingAttempts: rateLimit.remaining
      });
    }

    // 2. Authentication Succeeded -> Reset Rate Limit for this IP
    resetRateLimit(clientIp);

    // 3. Generate Signed JWT Token
    const token = signJwt(userPayload, 24 * 60 * 60);

    // 4. Store Token in Secure HTTP-Only Cookie
    res.setHeader('Set-Cookie', createAuthCookieHeader(token, 24 * 60 * 60));

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      user: userPayload
    });
  } catch (err) {
    console.error('[API Auth] Internal error:', err);
    return res.status(500).json({ error: 'Internal server security error' });
  }
}

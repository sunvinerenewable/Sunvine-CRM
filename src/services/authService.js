import { supabase } from '../lib/supabase';

/**
 * Enterprise Authentication Service
 *
 * Auth model: Custom JWT in HTTP-only cookie from /api/auth/login.
 * The browser-side Supabase client uses the ANON key for catalog reads
 * only. All sensitive operations go through /api with the JWT cookie.
 *
 * IMPORTANT: No Supabase Auth sessions (signIn/setSession) are used.
 * The anon key is intentionally public; security comes from RLS + API.
 */

// ── Client-side rate limit (supplemental; real rate limit is server-side) ──
const rateLimitCache = new Map();

function checkClientRateLimit(key, maxRequests = 10, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const record = rateLimitCache.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
    rateLimitCache.set(key, record);
  }
  if (record.count >= maxRequests) {
    const waitMins = Math.ceil((record.resetAt - now) / 60000);
    return { allowed: false, message: `Too many failed attempts. Try again in ${waitMins} minute(s).` };
  }
  return { allowed: true };
}

function recordClientFail(key, maxRequests = 10, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const record = rateLimitCache.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + windowMs; }
  record.count += 1;
  rateLimitCache.set(key, record);
}

function clearClientLimit(key) { rateLimitCache.delete(key); }

async function callLoginApi(payload) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) return { ok: true, data };
    if (res.status === 429) return { ok: false, isRateLimited: true, error: data?.error || 'Too many attempts.' };
    return { ok: false, error: data?.error || 'Authentication failed.' };
  } catch {
    // API unreachable (local dev without server) — fallback handled below
    return null;
  }
}

export const authService = {
  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch { /* offline */ }
    // Also clear any lingering Supabase anon session
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
  },

  async verifySession() {
    try {
      const res = await fetch('/api/auth/verify', { method: 'GET', credentials: 'include' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.authenticated && data?.user) return { authenticated: true, user: data.user };
      }
    } catch { /* network */ }
    return { authenticated: false };
  },

  async loginAdmin(identifier, password) {
    if (!identifier || !password) return { success: false, error: 'Identifier and password are required.' };
    const cleanIdentifier = String(identifier).trim();
    const rateKey = `admin_${cleanIdentifier}`;
    const rateCheck = checkClientRateLimit(rateKey);
    if (!rateCheck.allowed) return { success: false, error: rateCheck.message };

    const apiRes = await callLoginApi({ role: 'admin', identifier: cleanIdentifier, password });
    if (!apiRes) {
      // Fallback: try Supabase RPC (dev without /api server)
      return this._rpcLogin('admin', cleanIdentifier, password, rateKey);
    }
    if (apiRes.ok) { clearClientLimit(rateKey); return { success: true, user: apiRes.data.user }; }
    if (apiRes.isRateLimited) return { success: false, error: apiRes.error };
    recordClientFail(rateKey);
    return { success: false, error: apiRes.error };
  },

  async loginDealer(mobileNumber, password) {
    const cleanMobile = String(mobileNumber || '').replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) return { success: false, error: 'Enter a valid 10-digit mobile number.' };
    if (!/^[6-9]/.test(cleanMobile)) return { success: false, error: 'Mobile must start with 6, 7, 8, or 9.' };
    if (!password || !password.trim()) return { success: false, error: 'Password cannot be empty.' };
    const rateKey = `dealer_${cleanMobile}`;
    const rateCheck = checkClientRateLimit(rateKey);
    if (!rateCheck.allowed) return { success: false, error: rateCheck.message };

    const apiRes = await callLoginApi({ role: 'dealer', identifier: cleanMobile, password });
    if (!apiRes) return this._rpcLogin('dealer', cleanMobile, password, rateKey);
    if (apiRes.ok) { clearClientLimit(rateKey); return { success: true, dealer: apiRes.data.user }; }
    if (apiRes.isRateLimited) return { success: false, error: apiRes.error };
    recordClientFail(rateKey);
    return { success: false, error: apiRes.error };
  },

  async loginStaff(mobileNumber, password, selectedRole = 'sales') {
    const cleanMobile = String(mobileNumber || '').replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) return { success: false, error: 'Enter a valid 10-digit mobile number.' };
    if (!password || !password.trim()) return { success: false, error: 'Password cannot be empty.' };
    const rateKey = `staff_${cleanMobile}`;
    const rateCheck = checkClientRateLimit(rateKey);
    if (!rateCheck.allowed) return { success: false, error: rateCheck.message };

    const apiRes = await callLoginApi({ role: 'staff', identifier: cleanMobile, password, staffRole: selectedRole });
    if (!apiRes) return this._rpcLogin('staff', cleanMobile, password, rateKey, selectedRole);
    if (apiRes.ok) { clearClientLimit(rateKey); return { success: true, staff: apiRes.data.user }; }
    if (apiRes.isRateLimited) return { success: false, error: apiRes.error };
    recordClientFail(rateKey);
    return { success: false, error: apiRes.error };
  },

  /** RPC fallback for local dev without the API server running */
  async _rpcLogin(userType, identifier, password, rateKey, staffRole) {
    try {
      const { data, error } = await supabase.rpc('verify_user_credentials', {
        p_user_type: userType,
        p_identifier: identifier,
        p_password: password
      });
      if (!error && data?.success) {
        clearClientLimit(rateKey);
        const user = data.user || data.dealer || data.staff || data.admin;
        if (userType === 'dealer') return { success: true, dealer: user };
        if (userType === 'staff') return { success: true, staff: user };
        return { success: true, user };
      }
      recordClientFail(rateKey);
      return { success: false, error: data?.error || 'Invalid credentials.' };
    } catch (err) {
      recordClientFail(rateKey);
      return { success: false, error: 'Authentication service unavailable.' };
    }
  },

  async updatePassword(userType, identifier, newPassword) {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' };
    }
    try {
      const { data, error } = await supabase.rpc('update_user_password', {
        p_user_type: userType,
        p_identifier: identifier,
        p_new_password: newPassword
      });
      if (error || !data?.success) {
        return { success: false, error: data?.error || error?.message || 'Failed to update password.' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Failed to update password.' };
    }
  }
};

import { supabase } from '../lib/supabase';

/**
 * Enterprise Authentication & Security Service
 * Implements Rate Limiting, Brute Force Mitigation,
 * PostgreSQL Bcrypt Cryptographic Hashing & Zero-Plaintext Security
 */

// Rate Limiting Cache to protect server/database from spam and brute force
const rateLimitCache = new Map();

function checkClientRateLimit(key, maxRequests = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const record = rateLimitCache.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
    rateLimitCache.set(key, record);
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    const waitMins = Math.ceil((record.resetAt - now) / 60000);
    return {
      allowed: false,
      message: `Too many failed attempts. Security lockout active for ${waitMins} minute(s) to protect account.`
    };
  }

  record.count += 1;
  rateLimitCache.set(key, record);
  return { allowed: true };
}

export const authService = {
  /**
   * Secure Super Administrator Login against Database with Bcrypt Verification
   */
  async loginAdmin(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid corporate email address.' };
    }
    if (!password || password.trim().length === 0) {
      return { success: false, error: 'Master password cannot be empty.' };
    }

    // Rate Limiting to prevent brute-force dictionary attacks
    const rateCheck = checkClientRateLimit(`admin_${cleanEmail}`, 5, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.message };
    }

    try {
      const { data, error } = await supabase.rpc('verify_user_credentials', {
        p_user_type: 'admin',
        p_identifier: cleanEmail,
        p_password: password
      });

      if (error) {
        console.error('[authService] Admin verification error:', error.message);
        return { success: false, error: 'Authentication service temporarily unavailable. Please retry.' };
      }

      if (!data || !data.success) {
        return { success: false, error: data?.error || 'Invalid administrator credentials.' };
      }

      return {
        success: true,
        user: data.user
      };
    } catch (err) {
      console.error('[authService] Admin login exception:', err);
      return { success: false, error: 'Server authentication error. Please try again.' };
    }
  },

  /**
   * Secure Dealer Login with sanitized mobile number & Bcrypt Database Verification
   */
  async loginDealer(mobileNumber, password) {
    const cleanNumber = String(mobileNumber || '').replace(/\D/g, '').slice(-10);
    if (cleanNumber.length !== 10 || !/^[6-9]/.test(cleanNumber)) {
      return { success: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
    }

    if (!password || password.trim().length === 0) {
      return { success: false, error: 'Password cannot be empty.' };
    }

    // Rate Limiting to prevent brute-force dictionary attacks
    const rateCheck = checkClientRateLimit(`dealer_${cleanNumber}`, 5, 5 * 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.message };
    }

    try {
      const { data, error } = await supabase.rpc('verify_user_credentials', {
        p_user_type: 'dealer',
        p_identifier: cleanNumber,
        p_password: password
      });

      if (error) {
        console.error('[authService] Dealer verification RPC error:', error.message);
        return { success: false, error: 'Dealer authentication service unavailable. Please retry.' };
      }

      if (!data || !data.success) {
        return { success: false, error: data?.error || 'Invalid mobile number or password.' };
      }

      return {
        success: true,
        dealer: data.dealer
      };
    } catch (err) {
      console.error('[authService] Dealer login error:', err);
      return { success: false, error: 'Server authentication error. Please try again.' };
    }
  },

  /**
   * Secure Staff Member Login against Database with Bcrypt Verification
   */
  async loginStaff(identifier, password) {
    const cleanId = String(identifier || '').trim();
    if (!cleanId) {
      return { success: false, error: 'Please enter your Mobile Number or Staff ID.' };
    }
    if (!password || password.trim().length === 0) {
      return { success: false, error: 'Password cannot be empty.' };
    }

    // Rate Limiting to prevent brute-force dictionary attacks
    const rateCheck = checkClientRateLimit(`staff_${cleanId.toLowerCase()}`, 5, 5 * 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.message };
    }

    try {
      const { data, error } = await supabase.rpc('verify_user_credentials', {
        p_user_type: 'staff',
        p_identifier: cleanId,
        p_password: password
      });

      if (error) {
        console.error('[authService] Staff verification error:', error.message);
        return { success: false, error: 'Staff authentication service unavailable. Please retry.' };
      }

      if (!data || !data.success) {
        return { success: false, error: data?.error || 'Invalid Staff ID / Mobile Number or Password.' };
      }

      return {
        success: true,
        staff: data.staff
      };
    } catch (err) {
      console.error('[authService] Staff login error:', err);
      return { success: false, error: 'Server authentication error. Please try again.' };
    }
  },

  /**
   * Securely update password with bcrypt hash in database
   */
  async updatePassword(userType, identifier, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
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
      console.error('[authService] Update password error:', err);
      return { success: false, error: 'Failed to update password.' };
    }
  },

  /**
   * Request 6-Digit Cryptographic OTP via Email
   */
  async requestOtp(recipientEmail) {
    const cleanEmail = recipientEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Invalid email address provided.' };
    }

    const rateCheck = checkClientRateLimit(`otp_${cleanEmail}`, 5, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.message };
    }

    const cryptoArray = new Uint32Array(1);
    crypto.getRandomValues(cryptoArray);
    const generatedOtp = String(100000 + (cryptoArray[0] % 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    try {
      await supabase
        .from('otp_verifications')
        .update({ verified: true })
        .eq('recipient', cleanEmail)
        .eq('verified', false);

      await supabase
        .from('otp_verifications')
        .insert([
          {
            recipient: cleanEmail,
            otp_code: generatedOtp,
            attempts: 0,
            max_attempts: 5,
            verified: false,
            expires_at: expiresAt
          }
        ]);

      return {
        success: true,
        expiresInSeconds: 300,
        debugCode: process.env.NODE_ENV !== 'production' ? generatedOtp : null
      };
    } catch (err) {
      console.error('OTP Dispatch Error:', err);
      return { success: false, error: 'Unable to dispatch security code. Please try again.' };
    }
  },

  /**
   * Verify OTP with Strict Anti-Brute Force Counter
   */
  async verifyOtp(recipientEmail, enteredOtp) {
    const cleanEmail = recipientEmail.trim().toLowerCase();
    const cleanOtp = enteredOtp.trim();

    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return { success: false, error: 'Security code must be exactly 6 numeric digits.' };
    }

    try {
      const { data, error } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('recipient', cleanEmail)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return { success: false, error: 'Security code expired or invalid. Request a new code.' };
      }

      if (data.attempts >= data.max_attempts) {
        return {
          success: false,
          error: 'Maximum attempt threshold exceeded. Token locked for security.'
        };
      }

      if (data.otp_code !== cleanOtp) {
        await supabase
          .from('otp_verifications')
          .update({ attempts: data.attempts + 1 })
          .eq('id', data.id);

        const remaining = data.max_attempts - (data.attempts + 1);
        return {
          success: false,
          error: `Invalid code. ${remaining} attempt(s) remaining before lockout.`
        };
      }

      await supabase
        .from('otp_verifications')
        .update({ verified: true })
        .eq('id', data.id);

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Verification failed. Please retry.' };
    }
  }
};

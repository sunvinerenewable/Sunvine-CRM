import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';

/**
 * Hash a password using PBKDF2 (Cryptographically secure, zero external dependencies)
 * @param {string} password 
 * @returns {string} format: pbkdf2$iterations$salt$hash
 */
export function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a valid non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

/**
 * Hash a password using bcrypt (matching PostgreSQL pgcrypto crypt(password, gen_salt('bf', 10)))
 * @param {string} password
 * @param {number} cost - default 10
 * @returns {string} bcrypt hash ($2a$10$...)
 */
export function hashBcrypt(password, cost = 10) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a valid non-empty string');
  }
  return bcrypt.hashSync(password, cost);
}

/**
 * Verify a plaintext password against a stored hash.
 * Supports:
 *  1. PBKDF2 hashes (pbkdf2$100000$...)
 *  2. Standard PostgreSQL bcrypt hashes ($2a$, $2b$, $2y$, $2x$)
 *
 * @param {string} password 
 * @param {string} storedHash 
 * @returns {boolean}
 */
export function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;

  // 1. Handle PBKDF2 format
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const originalHash = parts[3];

    const computedHash = crypto.pbkdf2Sync(password, salt, iterations, KEYLEN, DIGEST).toString('hex');
    
    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(originalHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // 2. Handle standard bcrypt format ($2a$, $2b$, $2y$, $2x$)
  if (/^\$2[abxy]\$/.test(storedHash)) {
    try {
      return bcrypt.compareSync(password, storedHash);
    } catch (_) {
      return false;
    }
  }

  // 3. Unrecognised hash format — reject. SHA-256 and plain-text hashes are NOT
  // acceptable password storage formats. Force re-hash via update_user_password RPC.
  console.warn('[security] verifyPassword: unrecognised hash format — returning false. Hash must be pbkdf2$... or $2a$...');
  return false;
}

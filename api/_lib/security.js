import crypto from 'crypto';

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
 * Verify a plaintext password against a stored hash
 * Supports PBKDF2 and standard crypt comparison
 * @param {string} password 
 * @param {string} storedHash 
 * @returns {boolean}
 */
export function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  // Handle PBKDF2 format
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const originalHash = parts[3];

    const computedHash = crypto.pbkdf2Sync(password, salt, iterations, KEYLEN, DIGEST).toString('hex');
    
    // Constant-time buffer comparison to prevent timing attacks
    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(originalHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // Fallback constant-time comparison for mock/demo hashes
  const a = Buffer.from(crypto.createHash('sha256').update(password).digest('hex'));
  const b = Buffer.from(crypto.createHash('sha256').update(storedHash).digest('hex'));
  return crypto.timingSafeEqual(a, b);
}

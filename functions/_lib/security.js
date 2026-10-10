import bcrypt from 'bcryptjs';

const ITERATIONS = 100000;
const KEYLEN = 64;

/**
 * Hash password using WebCrypto PBKDF2
 */
export async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a valid non-empty string');
  }
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: 'SHA-512'
    },
    keyMaterial,
    KEYLEN * 8
  );

  const hash = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

/**
 * Hash password using bcryptjs ($2a$10$...)
 */
export async function hashBcrypt(password, cost = 10) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a valid non-empty string');
  }
  return bcrypt.hashSync(password, cost);
}

/**
 * Verify candidate password against PBKDF2 or bcrypt hash
 */
export async function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;

  // 1. PBKDF2 format
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const originalHash = parts[3];

    const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations,
        hash: 'SHA-512'
      },
      keyMaterial,
      KEYLEN * 8
    );

    const computedHash = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHash === originalHash;
  }

  // 2. Bcrypt format ($2a$, $2b$, $2y$, $2x$)
  if (/^\$2[abxy]\$/.test(storedHash)) {
    try {
      return await bcrypt.compare(password, storedHash);
    } catch (_) {
      return false;
    }
  }

  return false;
}

export function validatePasswordComplexity(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }
  const trimmed = password.trim();
  if (trimmed.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters and contain at least one special character (!@#$%^&* etc.).' };
  }
  const specialCharRegex = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\/\\`~;']/;
  if (!specialCharRegex.test(trimmed)) {
    return { valid: false, error: 'Password must contain at least one special character (!@#$%^&* etc.).' };
  }
  return { valid: true };
}

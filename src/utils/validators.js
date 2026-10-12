/**
 * validators.js — Standard Input Validation Utilities
 * Consistent validation rules across Dealer, Staff, and Admin portals.
 */

/**
 * Validates Indian mobile number (10 digits, optional +91 or 0 prefix)
 * @param {string} phone
 * @returns {boolean}
 */
export function validatePhone(phone) {
  if (!phone) return false;
  const cleaned = String(phone).replace(/[\s\-\(\)]/g, '');
  return /^(?:\+91|91|0)?[6-9]\d{9}$/.test(cleaned);
}

/**
 * Normalize Indian phone number to 10 digits
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/**
 * Validates Indian 15-character GSTIN
 * Format: 2 digits (State Code) + 10 chars (PAN) + 1 digit (entity) + 'Z' + 1 checksum
 * @param {string} gstin
 * @returns {boolean}
 */
export function validateGSTIN(gstin) {
  if (!gstin) return false;
  const cleaned = String(gstin).trim().toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleaned);
}

/**
 * Validates Indian 10-character PAN
 * @param {string} pan
 * @returns {boolean}
 */
export function validatePAN(pan) {
  if (!pan) return false;
  const cleaned = String(pan).trim().toUpperCase();
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleaned);
}

/**
 * Validates Indian 11-character Bank IFSC Code
 * @param {string} ifsc
 * @returns {boolean}
 */
export function validateIFSC(ifsc) {
  if (!ifsc) return false;
  const cleaned = String(ifsc).trim().toUpperCase();
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned);
}

/**
 * Validates 6-digit Indian PIN Code
 * @param {string|number} pincode
 * @returns {boolean}
 */
export function validatePinCode(pincode) {
  if (!pincode) return false;
  const cleaned = String(pincode).trim();
  return /^[1-9][0-9]{5}$/.test(cleaned);
}

/**
 * Validates standard email address
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  if (!email) return false;
  const cleaned = String(email).trim().toLowerCase();
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned);
}

/**
 * Validates solar system capacity in kW
 * @param {number|string} kw
 * @param {number} [min=0.5]
 * @param {number} [max=1000]
 * @returns {boolean}
 */
export function validateCapacityKW(kw, min = 0.5, max = 1000) {
  const num = Number(kw);
  return Number.isFinite(num) && num >= min && num <= max;
}

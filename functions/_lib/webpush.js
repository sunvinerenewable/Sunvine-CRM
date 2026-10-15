/**
 * functions/_lib/webpush.js
 *
 * WebCrypto + VAPID RFC 8291 / RFC 8292 implementation for Cloudflare Workers / Pages Functions
 */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToUrlBase64(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Create VAPID JWT token
 */
async function createVapidToken(audience, subject, publicKeyBase64, privateKeyBase64) {
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject
  };

  const encHeader = uint8ArrayToUrlBase64(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = uint8ArrayToUrlBase64(new TextEncoder().encode(JSON.stringify(payload)));
  const dataToSign = new TextEncoder().encode(`${encHeader}.${encPayload}`);

  // Import private key JWK
  // VAPID keys are ECDSA P-256
  const privKeyRaw = urlBase64ToUint8Array(privateKeyBase64);
  const pubKeyRaw = urlBase64ToUint8Array(publicKeyBase64);

  // Uncompressed P-256 is 65 bytes starting with 0x04: 1 byte prefix, 32 bytes X, 32 bytes Y
  const x = uint8ArrayToUrlBase64(pubKeyRaw.slice(1, 33));
  const y = uint8ArrayToUrlBase64(pubKeyRaw.slice(33, 65));
  const d = uint8ArrayToUrlBase64(privKeyRaw);

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d,
    ext: true
  };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    dataToSign
  );

  const encSignature = uint8ArrayToUrlBase64(new Uint8Array(signature));
  return `${encHeader}.${encPayload}.${encSignature}`;
}

/**
 * Encrypt payload using AES-GCM and ECDH per RFC 8291
 */
async function encryptPayload(subscriptionKeys, payloadString) {
  const userPublicKey = urlBase64ToUint8Array(subscriptionKeys.p256dh);
  const userAuth = urlBase64ToUint8Array(subscriptionKeys.auth);

  // Generate ephemeral local EC key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Import subscriber public key
  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    userPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Compute shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Export local public key
  const localPublicKeyBuffer = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyBuffer);

  // 16-byte random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF functions
  async function hkdfExtract(saltBytes, ikmBytes) {
    const key = await crypto.subtle.importKey('raw', saltBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = await crypto.subtle.sign('HMAC', key, ikmBytes);
    return new Uint8Array(prk);
  }

  async function hkdfExpand(prkBytes, infoBytes, length) {
    const key = await crypto.subtle.importKey('raw', prkBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const infoWithCounter = new Uint8Array(infoBytes.length + 1);
    infoWithCounter.set(infoBytes);
    infoWithCounter[infoBytes.length] = 1;
    const okm = await crypto.subtle.sign('HMAC', key, infoWithCounter);
    return new Uint8Array(okm).slice(0, length);
  }

  // PRK auth
  const prkAuth = await hkdfExtract(userAuth, sharedSecret);

  // Info for IKM
  const keyInfo = new TextEncoder().encode('WebPush: info\0');
  const ikmInfo = new Uint8Array(keyInfo.length + userPublicKey.length + localPublicKey.length);
  ikmInfo.set(keyInfo, 0);
  ikmInfo.set(userPublicKey, keyInfo.length);
  ikmInfo.set(localPublicKey, keyInfo.length + userPublicKey.length);

  const ikm = await hkdfExpand(prkAuth, ikmInfo, 32);

  // PRK from salt and IKM
  const prk = await hkdfExtract(salt, ikm);

  // Content encryption key & nonce info
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');

  const contentEncryptionKey = await hkdfExpand(prk, cekInfo, 16);
  const nonce = await hkdfExpand(prk, nonceInfo, 12);

  // Pad payload with delimiter 0x02 per RFC 8188
  const rawPayload = new TextEncoder().encode(payloadString);
  const paddedPayload = new Uint8Array(rawPayload.length + 1);
  paddedPayload.set(rawPayload, 0);
  paddedPayload[rawPayload.length] = 2; // delimiter

  // Encrypt with AES-GCM
  const aesKey = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    paddedPayload
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  // Build aes128gcm body: salt (16) + rs (4: 4096 = 0x00001000) + idlen (1: 65) + localPublicKey (65) + ciphertext
  const body = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.length);
  body.set(salt, 0);
  // rs = 4096 in big-endian
  body[16] = 0; body[17] = 0; body[18] = 0x10; body[19] = 0x00;
  // idlen = 65
  body[20] = 65;
  body.set(localPublicKey, 21);
  body.set(ciphertext, 21 + 65);

  return body;
}

/**
 * Send Web Push notification per RFC 8291 / 8292
 */
export async function sendWebPushNotification(subscription, payloadString, vapidDetails, options = {}) {
  const { endpoint, keys } = subscription;
  const { subject, publicKey, privateKey } = vapidDetails;

  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const vapidToken = await createVapidToken(audience, subject, publicKey, privateKey);

  const encryptedBody = await encryptPayload(keys, payloadString);

  const headers = {
    TTL: String(options.TTL || 86400),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    Authorization: `vapid t=${vapidToken}, k=${publicKey}`
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: encryptedBody
  });

  return response;
}

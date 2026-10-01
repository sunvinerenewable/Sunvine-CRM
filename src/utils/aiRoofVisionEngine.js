/**
 * AI Roof Vision Engine — client side
 *
 * Calls the /api/ai-analyze server endpoint which holds the Gemini API key
 * server-side. The browser never has access to the key.
 */

/**
 * Analyze a roof image via the server proxy.
 * @param {string} dataUrl  - base64 data URL of the image
 * @param {object} [params] - optional metadata
 * @returns {Promise<object>} analysis result
 */
export async function analyzeRoofImage(dataUrl, params = {}) {
  if (!dataUrl) throw new Error('Image data URL is required.');

  // Rough size guard: reject payloads > 8 MB before sending
  if (dataUrl.length > 8 * 1024 * 1024 * 1.37) {
    throw new Error('Image is too large (max ~8 MB). Please compress or crop the image.');
  }

  const res = await fetch('/api/ai-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',   // sends JWT HTTP-only cookie for auth
    body: JSON.stringify({ imageDataUrl: dataUrl, ...params })
  });

  if (res.status === 401) throw new Error('Please log in to use AI Roof Analysis.');
  if (res.status === 429) throw new Error('Too many analysis requests. Please wait and try again.');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI analysis failed (${res.status}).`);
  }

  return res.json();
}

// Legacy export alias so existing components importing getGeminiApiKey/saveGeminiApiKey
// don't hard-crash (they will receive a deprecation notice instead).
export function getGeminiApiKey() {
  console.warn('[aiRoofVisionEngine] getGeminiApiKey() is deprecated. Gemini key is now server-only.');
  return null;
}

export function saveGeminiApiKey() {
  console.warn('[aiRoofVisionEngine] saveGeminiApiKey() is deprecated. Gemini key is now server-only.');
}

/**
 * Legacy alias for backward compatibility with RooftopDesigner.jsx.
 * The _apiKey param is ignored — key is now server-side only.
 */
export async function scanRoofSketch(dataUrl, _apiKey) {
  return analyzeRoofImage(dataUrl);
}

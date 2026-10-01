import { verifyJwt } from './_lib/jwt.js';
import { checkRateLimit, recordFailedAttempt, getClientIp } from './_lib/rateLimiter.js';

/**
 * POST /api/ai-analyze
 * Server-side proxy for Google Gemini Vision API.
 * The GEMINI_API_KEY env var is NEVER exposed to the client.
 *
 * Request body: { imageDataUrl: string, ...optional metadata }
 * Response: { polygons, roofArea, confidence, ... }
 */

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB base64 → ~6 MB actual

function parseCookies(cookieHeader = '') {
  const out = {};
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([a-zA-Z0-9+/-]+);base64,(.+)$/);
  if (!match) return { mimeType: 'image/jpeg', base64Data: dataUrl };
  return { mimeType: match[1], base64Data: match[2] };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // ── Auth check ──────────────────────────────────────────────────────────
  const cookies = parseCookies(req.headers.cookie);
  const jwtResult = verifyJwt(cookies.sunvine_auth_token);
  if (!jwtResult.valid) return res.status(401).json({ error: 'Authentication required.' });

  // ── Rate limit: 20 AI calls / 10 min per IP ────────────────────────────
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip, { maxAttempts: 20, windowMs: 10 * 60 * 1000, increment: false });
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Too many AI requests. Please wait and try again.' });
  }

  const { imageDataUrl, ...meta } = req.body || {};
  if (!imageDataUrl) return res.status(400).json({ error: 'imageDataUrl is required.' });
  if (imageDataUrl.length > MAX_IMAGE_BYTES * 1.37) {
    return res.status(413).json({ error: 'Image too large. Maximum size is 8 MB.' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('[ai-analyze] GEMINI_API_KEY env var not set.');
    return res.status(503).json({ error: 'AI service temporarily unavailable.' });
  }

  recordFailedAttempt(ip, { maxAttempts: 20, windowMs: 10 * 60 * 1000 });

  try {
    const { mimeType, base64Data } = parseDataUrl(imageDataUrl);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inlineData: { mimeType, data: base64Data }
              },
              {
                text: 'Analyze this rooftop image for a solar installation. Return a JSON object with: polygons (array of polygon vertex coordinates as [{x, y}]), estimatedRoofAreaSqm (number), usableAreaSqm (number), confidence (0-1), obstructions (array of strings). Be concise.'
              }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('[ai-analyze] Gemini API error:', geminiRes.status, errBody.slice(0, 200));
      return res.status(502).json({ error: 'AI provider returned an error. Try again later.' });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON from model response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: 'AI response unparseable. Try again.' });

    const result = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ success: true, ...result });

  } catch (err) {
    console.error('[ai-analyze] Error:', err.message);
    return res.status(500).json({ error: 'AI analysis failed. Please try again.' });
  }
}

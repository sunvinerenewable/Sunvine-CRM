import { requireUser } from '../_lib/requireAuth.js';
import { checkDistributedRateLimit, recordFailedAttempt, getClientIp } from '../_lib/rateLimiter.js';
import { getCorsHeaders, handleOptionsResponse } from '../_lib/cors.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([a-zA-Z0-9+/-]+);base64,(.+)$/);
  if (!match) return { mimeType: 'image/jpeg', base64Data: dataUrl };
  return { mimeType: match[1], base64Data: match[2] };
}

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return handleOptionsResponse(request, env);
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed' }, { status: 405, headers: corsHeaders });
  }

  // Auth check
  const { payload: user, errorResponse } = await requireUser(request, env);
  if (errorResponse) {
    for (const [k, v] of corsHeaders.entries()) errorResponse.headers.set(k, v);
    return errorResponse;
  }

  // Rate limit
  const ip = getClientIp(request);
  const rateCheck = await checkDistributedRateLimit(env, `ai_${ip}`, { maxAttempts: 20, windowMs: 10 * 60 * 1000 });
  if (!rateCheck.allowed) {
    return Response.json({ error: 'Too many AI requests. Please wait and try again.' }, { status: 429, headers: corsHeaders });
  }

  let body = {};
  try {
    body = await request.json();
  } catch (_) {}

  const { imageDataUrl } = body;
  if (!imageDataUrl) return Response.json({ error: 'imageDataUrl is required.' }, { status: 400, headers: corsHeaders });
  if (imageDataUrl.length > MAX_IMAGE_BYTES * 1.37) {
    return Response.json({ error: 'Image too large. Maximum size is 8 MB.' }, { status: 413, headers: corsHeaders });
  }

  const geminiKey = env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('[ai-analyze] GEMINI_API_KEY env var not set.');
    return Response.json({ error: 'AI service temporarily unavailable.' }, { status: 503, headers: corsHeaders });
  }

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
      return Response.json({ error: 'AI provider returned an error. Try again later.' }, { status: 502, headers: corsHeaders });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json({ error: 'AI response unparseable. Try again.' }, { status: 502, headers: corsHeaders });

    const result = JSON.parse(jsonMatch[0]);
    return Response.json({
      success: true,
      polygons: result.polygons ?? [],
      estimatedRoofAreaSqm: result.estimatedRoofAreaSqm ?? null,
      usableAreaSqm: result.usableAreaSqm ?? null,
      confidence: result.confidence ?? null,
      obstructions: result.obstructions ?? []
    }, { status: 200, headers: corsHeaders });

  } catch (err) {
    recordFailedAttempt(ip, { maxAttempts: 20, windowMs: 10 * 60 * 1000 });
    console.error('[ai-analyze] Error:', err.message);
    return Response.json({ error: 'AI analysis failed. Please try again.' }, { status: 500, headers: corsHeaders });
  }
}

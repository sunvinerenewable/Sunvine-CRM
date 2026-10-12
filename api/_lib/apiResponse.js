/**
 * apiResponse.js — Scalable API Response Helpers
 * Standardizes success and error payload formats across all serverless endpoints.
 */

/**
 * Send standard success response
 * @param {import('http').ServerResponse} res
 * @param {any} data
 * @param {object} [meta]
 * @param {number} [statusCode=200]
 */
export function jsonSuccess(res, data = null, meta = null, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  
  const payload = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString()
  };

  res.end(JSON.stringify(payload));
  return payload;
}

/**
 * Send standard error response
 * @param {import('http').ServerResponse} res
 * @param {number} statusCode
 * @param {string} message
 * @param {any} [details=null]
 * @param {string} [code='API_ERROR']
 */
export function jsonError(res, statusCode = 500, message = 'Internal Server Error', details = null, code = 'API_ERROR') {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');

  const payload = {
    success: false,
    error: message,
    code,
    ...(details ? { details } : {}),
    timestamp: new Date().toISOString()
  };

  res.end(JSON.stringify(payload));
  return payload;
}

/**
 * Parse incoming JSON request body safely
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<any>}
 */
export async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/**
 * errorHandler.js — Enterprise Serverless Error Handler & Request Wrapper
 * Enforces Rule 2 (Adversarial Security): never leak passwords, tokens, or raw DB errors.
 */

import { applyCors } from './cors.js';
import { jsonError } from './apiResponse.js';
import { getClientIp, checkDistributedRateLimit } from './rateLimiter.js';

/**
 * Sanitize error messages before sending to client
 * Prevents information disclosure (database strings, stack traces, credentials)
 * @param {any} err
 * @returns {{ statusCode: number, message: string, code: string }}
 */
export function sanitizeError(err) {
  const statusCode = err?.statusCode || err?.status || 500;
  const rawMessage = String(err?.message || err || '');

  // Default code
  let code = err?.code || 'INTERNAL_ERROR';

  // Check known sensitive patterns
  if (
    rawMessage.includes('password') ||
    rawMessage.includes('jwt') ||
    rawMessage.includes('token') ||
    rawMessage.includes('secret') ||
    rawMessage.includes('postgresql://') ||
    rawMessage.includes('pg_') ||
    rawMessage.includes('connection refused')
  ) {
    return {
      statusCode: statusCode >= 400 && statusCode < 500 ? statusCode : 500,
      message: statusCode >= 400 && statusCode < 500 ? 'Invalid request parameter or credentials.' : 'Database or service temporarily unavailable.',
      code: 'SERVICE_ERROR'
    };
  }

  // Common user-safe errors
  if (statusCode === 400 || err?.name === 'ValidationError') {
    return { statusCode: 400, message: rawMessage || 'Bad Request', code: 'VALIDATION_ERROR' };
  }
  if (statusCode === 401) {
    return { statusCode: 401, message: rawMessage || 'Unauthorized access', code: 'UNAUTHORIZED' };
  }
  if (statusCode === 403) {
    return { statusCode: 403, message: rawMessage || 'Forbidden', code: 'FORBIDDEN' };
  }
  if (statusCode === 404) {
    return { statusCode: 404, message: rawMessage || 'Resource not found', code: 'NOT_FOUND' };
  }
  if (statusCode === 429) {
    return { statusCode: 429, message: rawMessage || 'Too many requests. Please slow down.', code: 'RATE_LIMITED' };
  }

  return {
    statusCode: 500,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error occurred.' : rawMessage || 'Unknown internal error',
    code
  };
}

/**
 * Higher-order wrapper for serverless API handlers
 * Enforces CORS, OPTIONS handling, rate limits, and safe execution.
 * @param {Function} handler
 * @param {object} [options]
 * @param {number} [options.rateLimitMax=120]
 * @param {number} [options.rateLimitWindowSec=60]
 * @returns {Function}
 */
export function withApiHandler(handler, options = {}) {
  const { rateLimitMax = 120, rateLimitWindowSec = 60 } = options;

  return async function wrappedApiHandler(req, res) {
    // 1. CORS
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // 2. Rate limiting (if enabled)
    if (rateLimitMax > 0) {
      const ip = getClientIp(req);
      const rlKey = `rl:handler:${req.url?.split('?')[0]}:${ip}`;
      const rlResult = await checkDistributedRateLimit(rlKey, rateLimitMax, rateLimitWindowSec);
      if (!rlResult.allowed) {
        return jsonError(res, 429, 'Rate limit exceeded. Please wait before retrying.', null, 'RATE_LIMITED');
      }
    }

    // 3. Execution with catch
    try {
      return await handler(req, res);
    } catch (error) {
      console.error(`[API Handler Error] [${req.method}] ${req.url}:`, error?.message || error);
      const { statusCode, message, code } = sanitizeError(error);
      return jsonError(res, statusCode, message, null, code);
    }
  };
}

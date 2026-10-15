import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * k6 Load Test: Quotation & Catalog Endpoints
 * 
 * Simulates 200 concurrent Virtual Users (VUs) testing:
 * 1. GET /api/catalog (cached/catalog retrieval)
 * 2. GET /api/quotations?action=list (quotations listing)
 * 
 * Safety Check: Aborts immediately if executed against production URLs.
 */

const BASE_URL = __ENV.TARGET_URL || __ENV.BASE_URL || 'http://localhost:3000';

// ── Production Safety Guard ──────────────────────────────────────────────────
function validateTargetEnvironment(url) {
  const forbiddenPatterns = [
    'sunvinerenewable.com',
    'sunvine.in',
    'dealer.sunvine',
    'sunvine-dealer-portal.vercel.app',
    'prod',
    'production'
  ];

  const lowerUrl = url.toLowerCase();
  for (const pattern of forbiddenPatterns) {
    if (lowerUrl.includes(pattern)) {
      throw new Error(`[SAFETY CRITICAL] Load testing against production target (${url}) is strictly forbidden! Aborting.`);
    }
  }
}

validateTargetEnvironment(BASE_URL);

// ── Test Configuration ───────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Warm-up ramp
    { duration: '1m', target: 200 },    // Ramp up to peak 200 VUs
    { duration: '1m', target: 200 },    // Sustain peak load
    { duration: '30s', target: 0 }      // Cool down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<800', 'p(99)<1500'], // 95% of requests under 800ms
    'http_req_failed': ['rate<0.01'],                  // Error rate strictly < 1%
  },
};

const HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'k6-load-test/sunvine-portal',
};

export default function () {
  // ── 1. Test /api/catalog ───────────────────────────────────────────────────
  const catalogRes = http.get(`${BASE_URL}/api/catalog`, { headers: HEADERS });
  
  check(catalogRes, {
    'catalog status is 200': (r) => r.status === 200,
    'catalog response time < 500ms': (r) => r.timings.duration < 500,
    'catalog body has modules or data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && (body.modules || body.solarModules || body.settings || body.success !== false);
      } catch (_) {
        return false;
      }
    }
  });

  sleep(0.5);

  // ── 2. Test /api/quotations?action=list ─────────────────────────────────────
  const quoteParams = {
    dealerId: 'SV-DLR-0851',
    limit: 20,
    offset: 0
  };

  const quotesRes = http.get(`${BASE_URL}/api/quotations?action=list&dealerId=${quoteParams.dealerId}&limit=${quoteParams.limit}`, {
    headers: HEADERS
  });

  check(quotesRes, {
    'quotations status is 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
    'quotations response time < 800ms': (r) => r.timings.duration < 800,
  });

  sleep(1);
}

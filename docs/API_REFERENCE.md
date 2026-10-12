# Sunvine Renewable Energy — API Reference & Conventions

## 1. Overview & Conventions

All backend API routes reside under `/api/` and are deployed as serverless functions.

### Protocol Standards
- **Transport**: HTTPS only
- **Authentication**: JWT stored in HTTP-Only `sunvine_auth_token` cookie or `Authorization: Bearer <token>`
- **Content-Type**: `application/json`
- **CORS Policy**: Strict origin allowlist from `ALLOWED_ORIGINS` (SEC-001)

---

## 2. Standardized Response Format

All endpoints follow uniform response payloads via `api/_lib/apiResponse.js`:

### Success Response (`200 OK` / `201 Created`)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "count": 25,
    "total": 120,
    "page": 1
  },
  "timestamp": "2026-10-12T03:30:00.000Z"
}
```

### Error Response (`400`, `401`, `403`, `404`, `429`, `500`)
```json
{
  "success": false,
  "error": "Human-readable sanitized error message",
  "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | RATE_LIMITED | SERVICE_ERROR",
  "details": null,
  "timestamp": "2026-10-12T03:30:00.000Z"
}
```

---

## 3. Core API Endpoints

### 3.1 Authentication (`/api/auth/[action]`)
- **`POST /api/auth/login`**: Authenticate using phone/email and password/PIN. Issues HTTP-Only JWT cookie.
- **`POST /api/auth/logout`**: Clears authentication cookies and invalidates session.
- **`GET /api/auth/verify`**: Verifies existing JWT token and returns user profile and permissions.
- **`POST /api/auth/manage`**: Admin-only user management (create dealer, reset password, change account status).

### 3.2 Quotations (`/api/quotations`)
- **`GET /api/quotations`**: Fetch quotations with pagination (`limit`, `offset`) and role-based tenancy scoping.
- **`POST /api/quotations`** (action: `save`): Create or upsert quotation with server-side arithmetic verification, unguessable `share_token` generation, and audit logging.
- **`POST /api/quotations`** (action: `delete`): Soft or hard delete quotation by ID.
- **`POST /api/quotations`** (action: `public_view`): Unauthenticated retrieval of customer proposals using unguessable `share_token`.

### 3.3 Customer Applications (`/api/customer-files`)
- **`GET /api/customer-files`**: Retrieve customer files matching dealer or staff tenancy.
- **`POST /api/customer-files`**: Create customer file, update document checklist, or progress through pipeline stages. Automatically posts updates to Slack threads via `slackSync.js`.

### 3.4 Catalog & System Settings (`/api/catalog`)
- **`GET /api/catalog`**: Retrieve hardware master (modules, inverters), default BOM items, tier margin caps, and system settings.
- **`POST /api/catalog`**: Admin-only update of catalog items, statutory tax percentages, and governance rules.

### 3.5 Storage & Document Management
- **`POST /api/storage-presign`**: Generate Cloudflare R2 presigned PUT URLs for secure client-side document uploads. Validates MIME types, extensions, and file sizes (<= 2MB).
- **`GET /api/storage-download`**: Secure token-gated document download proxy.
- **`POST /api/storage-delete`**: Soft/hard document deletion with tenant isolation.

---

## 4. Middleware & Security Pipeline

| Middleware | File | Purpose |
|------------|------|---------|
| `applyCors` | `api/_lib/cors.js` | Enforces exact origin match against `ALLOWED_ORIGINS` |
| `checkDistributedRateLimit` | `api/_lib/rateLimiter.js` | Upstash Redis sliding window limiter with in-memory fallback |
| `requireUser` | `api/_lib/requireAuth.js` | Authenticates JWT and validates account status in database |
| `requireAdmin` | `api/_lib/requireAuth.js` | Enforces `role === 'admin'` RBAC restriction |
| `withApiHandler` | `api/_lib/errorHandler.js` | Wraps route in try/catch, sanitizes error output, logs cleanly |

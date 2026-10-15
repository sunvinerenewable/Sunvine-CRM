# Sunvine Renewable Energy — Environment Configuration Guide

## 1. Overview

The portal uses strict separation between **Client-side** variables (accessible in the browser via `import.meta.env.VITE_*`) and **Server-side** variables (accessible only in Node/serverless via `process.env.*`).

---

## 2. Environment Variables Reference

### 2.1 Client-Side (`VITE_*`)
Exposed in browser bundles. Handled centrally by `src/config/env.js`.

| Variable | Description | Safe for Client? |
|----------|-------------|------------------|
| `VITE_SUPABASE_URL` | Supabase project endpoint (e.g. `https://xyz.supabase.co`) | ✅ Yes |
| `VITE_SUPABASE_ANON_KEY` | Public anon key for read-only catalog queries | ✅ Yes |
| `VITE_GEOAPIFY_API_KEY` | Geoapify map tiles key (HTTP restricted) | ✅ Yes |
| `VITE_GOOGLE_PLACES_API_KEY` | Google Places API key (HTTP restricted) | ✅ Yes |
| `VITE_BASE_URL` | Application root URL for public proposal share links | ✅ Yes |

### 2.2 Server-Side (Serverless & Migrations Only)
Stored in `.env` (gitignored) and Vercel Project Settings. Handled centrally by `api/_lib/env.js`.

> [!CAUTION]
> NEVER prefix any of the following variables with `VITE_`. Doing so exposes database credentials and secrets to the browser.

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin service key with full DB privileges (bypasses RLS) | ✅ Required |
| `DATABASE_URL` | PostgreSQL connection string for pooled queries | ✅ Required |
| `JWT_SECRET` | 64+ char random secret for session JWT signing | ✅ Required |
| `ALLOWED_ORIGINS` | Comma-separated allowlist for CORS (no wildcards) | ✅ Required |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL for distributed rate limiting | ⚡ Recommended |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST auth token | ⚡ Recommended |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare R2 Account ID for S3-compatible document storage | ⚡ Optional |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 Access Key ID | ⚡ Optional |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Access Key | ⚡ Optional |
| `R2_BUCKET_NAME` | R2 Bucket name (default: `sunvine-documents`) | ⚡ Optional |
| `SLACK_BOT_TOKEN` | Slack Bot OAuth Token for application thread sync | ⚡ Optional |
| `SLACK_FILES_CHANNEL_ID` | Slack Channel ID for customer file notifications | ⚡ Optional |
| `SLACK_CRASH_WEBHOOK_URL`| Slack incoming webhook for fatal crash reporting | ⚡ Optional |

---

## 3. Switching Environments

Helper scripts in `package.json`:
```bash
# Switch to staging environment
npm run env:staging

# Switch to production environment
npm run env:prod

# Check current active environment
npm run env:status
```

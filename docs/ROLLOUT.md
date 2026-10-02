# Sunvine Solar Portal — Production Security Rollout Guide

> **CRITICAL WARNING:**
> DO NOT apply `002_rls_lockdown.sql` to your Supabase database before deploying the updated application code and serverless API functions.
> Applying the lockdown beforehand will immediately deny all anonymous and client-side database reads, breaking the portal for active users.

---

## 1. Prerequisites & Required Secrets

Before beginning rollout, ensure the following environment variables are configured in the **Vercel Dashboard** (Settings → Environment Variables):

| Variable Name | Environment | Description |
|---|---|---|
| `JWT_SECRET` | Production & Preview | Minimum 32 random characters (e.g. 64-character hex string) |
| `SUPABASE_URL` | Production & Preview | Supabase project URL (`https://<project-ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production & Preview | **Secret** service_role key from Supabase Dashboard |
| `GEMINI_API_KEY` | Production & Preview | Google AI Studio API Key for AI roof vision |
| `VITE_SUPABASE_URL` | Production & Preview | Supabase project URL (client-facing) |
| `VITE_SUPABASE_ANON_KEY` | Production & Preview | Supabase anon/publishable key |
| `UPSTASH_REDIS_REST_URL` | *(Optional)* | Upstash REST URL for persistent serverless rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | *(Optional)* | Upstash REST Token |

---

## 2. Step-by-Step Rollout Order

### Step 1: Pre-Deployment Account Provisioning (MANUAL GATE)
Because all backdoor plaintext passwords (`admin123`, `dealer123`, `staff123`, `verify123`) have been eliminated:
1. Ensure real administrator and staff accounts exist in your database with valid password hashes.
2. Use the provisioning script locally:
   ```bash
   # Set service credentials in your local terminal:
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

   # Create or update the Super Admin:
   node scripts/createAccount.mjs --role admin --email admin@sunvinerenewable.com --name "Super Administrator"
   ```
   *The script prompts for the password securely and stores it as a salted PBKDF2 hash.*

---

### Step 2: Deploy Code to Staging / Vercel Preview
1. Push branch `fix/audit-v2` to GitHub and create a Pull Request to `sumit-updates`.
2. Allow Vercel to build and deploy the Preview deployment.
3. Verify that `npm test` and `npm run build` completed with **0 errors**.
4. Test login on the Preview deployment using the credentials created in Step 1.
5. Create a test quotation on the Preview deployment to confirm the `/api/quotations` endpoint recomputes and saves correctly.

---

### Step 3: Apply Migration 001 (Numeric Columns Backfill)
Open the **Supabase Dashboard → SQL Editor** on your **Staging** project first (or Production maintenance window):
1. Execute `supabase/migrations/001_numeric_prices.sql`.
2. Run the verification queries:
   ```sql
   SELECT id, brand, rate_per_wp, rate_per_wp_inr FROM public.solar_modules LIMIT 5;
   SELECT id, brand, base_price, base_price_inr FROM public.solar_inverters LIMIT 5;
   ```
3. Confirm `rate_per_wp_inr` and `base_price_inr` contain numeric values without currency symbols.

---

### Step 4: Promote Code to Production
1. Merge the Pull Request into `sumit-updates` (or production branch per repository directives).
2. Confirm the production Vercel deployment completes successfully.
3. Test production login with your administrator account.

---

### Step 5: Apply Migration 002 (RLS Lockdown)
Once the production code is running and confirmed healthy:
1. Open **Supabase Dashboard → SQL Editor**.
2. Execute `supabase/migrations/002_rls_lockdown.sql`.
3. Verify that RLS is active:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
   ```
4. Verify that anonymous REST access is blocked:
   ```bash
   # Attempting to read quotations with the anon key must return empty or 401/403:
   curl -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
     "https://<project-ref>.supabase.co/rest/v1/quotations?select=id,customer_name"
   ```

---

### Step 6: Post-Deployment Security Hygiene
1. **Rotate PostgreSQL Password:** In Supabase Dashboard → Settings → Database, reset the database password (the leaked password from `seedAllDatabase.mjs` was committed to git history previously).
2. **Make Storage Bucket Private:** Confirm bucket `sunvine-documents` in Supabase Storage has Public Bucket = OFF.
3. **Rotate Gemini API Key:** In Google Cloud / AI Studio, revoke the old API key and generate a new one.

---

## 3. Rollback Plan
If an unexpected issue occurs after Step 5 (RLS lockdown):
1. To temporarily restore client access while diagnosing:
   ```sql
   -- Emergency temporary policy (Staging only!):
   -- ALTER TABLE public.quotations DISABLE ROW LEVEL SECURITY;
   ```
2. Re-enable RLS immediately once the issue is identified and resolved.

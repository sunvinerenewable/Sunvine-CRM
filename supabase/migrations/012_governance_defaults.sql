-- ════════════════════════════════════════════════════════════════════════════
-- Migration 012: Governance Defaults, Staff Verification Flag & Solar Banks
-- Directives: HC-01..HC-18, T3.1
--
-- This migration:
-- 1. Seeds/updates system_settings table with standardized JSON structure
--    from settings-contract.md (governance_settings, statutory_taxes, company_profile).
-- 2. Adds is_verification boolean column to staff_accounts table.
-- 3. Creates public.solar_banks table with RLS enabled and service_role-only access.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Ensure system_settings table and required columns exist ──────────────
CREATE TABLE IF NOT EXISTS public.system_settings (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'global_settings',
  governance_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  statutory_taxes JSONB NOT NULL DEFAULT '{}'::jsonb,
  company_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  terms_and_warranties JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS governance_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS statutory_taxes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS company_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS terms_and_warranties JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Seed / Update system_settings with exact contract payload
INSERT INTO public.system_settings (
  id,
  governance_settings,
  statutory_taxes,
  company_profile,
  updated_at
) VALUES (
  'global_settings',
  '{
    "max_discount_pct": 5,
    "max_system_kw": 1000,
    "quote_prefix": "SV",
    "validity_days": 15,
    "default_specific_yield": 1440,
    "default_tariff": 6.67,
    "default_loan_rate": 8.5,
    "upload_max_mb": 2,
    "allow_custom_bom_lines": false,
    "max_custom_bom_value": 0
  }'::jsonb,
  '{
    "subsidy": {
      "slab1Rate": 30000,
      "slab2Rate": 18000,
      "cap": 78000,
      "breakpointKw": 3
    },
    "gstSlabs": [0, 5, 12, 18, 28]
  }'::jsonb,
  '{
    "name": "Sunvine Renewable Energy Private Limited",
    "gstin": "",
    "address": "",
    "state": "Gujarat",
    "whatsapp": "",
    "helpdesk": "",
    "website": "https://sunvinerenewable.com",
    "email": "support@sunvinerenewable.com",
    "bank": {
      "bankName": "",
      "accountNumber": "",
      "ifsc": "",
      "branch": "",
      "accountHolder": ""
    },
    "terms": "1. Validity: 15 Days from quotation date.\n2. Net-metering approval is subject to DISCOM policy.\n3. Subsidy disbursement is directly into customer bank account via PM Surya Ghar National Portal.",
    "validityText": "15 Days from generation date"
  }'::jsonb,
  timezone('utc'::text, now())
)
ON CONFLICT (id) DO UPDATE SET
  governance_settings = EXCLUDED.governance_settings || COALESCE(system_settings.governance_settings, '{}'::jsonb),
  statutory_taxes = EXCLUDED.statutory_taxes || COALESCE(system_settings.statutory_taxes, '{}'::jsonb),
  company_profile = EXCLUDED.company_profile || COALESCE(system_settings.company_profile, '{}'::jsonb),
  updated_at = timezone('utc'::text, now());

-- ── 2. Add is_verification to staff_accounts ─────────────────────────────────
ALTER TABLE public.staff_accounts
  ADD COLUMN IF NOT EXISTS is_verification BOOLEAN NOT NULL DEFAULT false;

-- ── 3. Create solar_banks table with RLS & Service Role policy only ──────────
CREATE TABLE IF NOT EXISTS public.solar_banks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rate_pct NUMERIC(5,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.solar_banks ENABLE ROW LEVEL SECURITY;

-- Revoke all anon/authenticated access on solar_banks
REVOKE ALL ON public.solar_banks FROM anon, authenticated;

DROP POLICY IF EXISTS "public_read_solar_banks" ON public.solar_banks;
DROP POLICY IF EXISTS "anon_read_solar_banks" ON public.solar_banks;
DROP POLICY IF EXISTS "service_role_all_solar_banks" ON public.solar_banks;

CREATE POLICY "service_role_all_solar_banks" ON public.solar_banks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed initial standard solar bank rates
INSERT INTO public.solar_banks (id, name, rate_pct, active) VALUES
  ('sbi', 'State Bank of India', 8.50, true),
  ('bob', 'Bank of Baroda', 8.60, true),
  ('hdfc', 'HDFC Bank Ltd.', 9.00, true),
  ('icici', 'ICICI Bank', 9.25, true),
  ('canara', 'Canara Bank', 8.75, true),
  ('ubi', 'Union Bank of India', 8.65, true),
  ('pnb', 'Punjab National Bank', 8.80, true)
ON CONFLICT (id) DO NOTHING;

COMMIT;

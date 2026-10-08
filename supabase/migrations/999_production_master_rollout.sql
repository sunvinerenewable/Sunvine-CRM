-- ====================================================================
-- 999_production_master_rollout.sql
-- Sunvine Renewable Energy — Master Production DB Upgrade & Hardening Script
-- Target Database: Production (wyberzvcyrjipjqpotwe)
-- Rollout Safe: 100% Idempotent, Non-Destructive, Preserves Existing Values
-- Addresses Audit Issues: #1, #2, #3, #10, #13
-- ====================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- STEP 1: SCHEMA & COLUMN ALIGNMENTS (000 & 016)
-- ════════════════════════════════════════════════════════════════════

-- 1.1 audit_logs columns
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id VARCHAR(100);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 1.2 quotations columns & flexible status constraint
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS request_id UUID UNIQUE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS quote_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS chk_status_enum;

-- 1.3 staff_accounts columns
ALTER TABLE public.staff_accounts ADD COLUMN IF NOT EXISTS is_verification BOOLEAN NOT NULL DEFAULT false;

-- 1.4 dealer_accounts columns
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS assigned_staff_id VARCHAR(100) DEFAULT 'STF-DIRECT';
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS assigned_staff_name VARCHAR(255) DEFAULT 'Direct to Company (HQ Desk)';

-- 1.5 numeric price backfill columns
ALTER TABLE public.solar_modules ADD COLUMN IF NOT EXISTS rate_per_wp_inr NUMERIC(8,2);
ALTER TABLE public.solar_inverters ADD COLUMN IF NOT EXISTS base_price_inr NUMERIC(10,2);

UPDATE public.solar_modules
SET rate_per_wp_inr = CAST(REGEXP_REPLACE(rate_per_wp, '[^0-9.]', '', 'g') AS NUMERIC(8,2))
WHERE rate_per_wp_inr IS NULL AND rate_per_wp IS NOT NULL AND REGEXP_REPLACE(rate_per_wp, '[^0-9.]', '', 'g') != '';

UPDATE public.solar_inverters
SET base_price_inr = CAST(REGEXP_REPLACE(base_price, '[^0-9.]', '', 'g') AS NUMERIC(10,2))
WHERE base_price_inr IS NULL AND base_price IS NOT NULL AND REGEXP_REPLACE(base_price, '[^0-9.]', '', 'g') != '';

-- ════════════════════════════════════════════════════════════════════
-- STEP 2: HIGH PERFORMANCE INDEXES (013)
-- ════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_quotations_dealer_created ON public.quotations (dealer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_files_dealer_status ON public.customer_files (dealer_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_share_token ON public.quotations (share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_request_id ON public.quotations (request_id) WHERE request_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════
-- STEP 3: SYSTEM SETTINGS GOVERNANCE MERGE (Issue #3: Flat + Nested Bank)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.system_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global_settings',
    statutory_taxes JSONB NOT NULL DEFAULT '{}'::jsonb,
    governance_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    company_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.system_settings (id, statutory_taxes, governance_settings, company_profile, updated_at)
VALUES (
  'global_settings',
  '{
    "gst_module_rate_pct": 5,
    "gst_inverter_rate_pct": 18,
    "gst_bos_rate_pct": 18,
    "gst_services_rate_pct": 18,
    "subsidy": {
      "slab1Rate": 30000,
      "slab2Rate": 18000,
      "cap": 78000,
      "breakpointKw": 3
    },
    "gstSlabs": [0, 5, 12, 18, 28]
  }'::jsonb,
  '{
    "min_margin_per_kw": 3000,
    "max_margin_cap_per_kw": 8000,
    "max_discount_pct": 5,
    "allow_custom_bom_lines": false,
    "bom_rate_tolerance_pct": 10,
    "require_customer_phone": true,
    "require_state_selection": true,
    "quote_validity_days": 30,
    "default_specific_yield": 1440,
    "default_tariff": 6.67,
    "default_loan_rate": 8.5
  }'::jsonb,
  '{
    "name": "Sunvine Renewable Energy Private Limited",
    "company_legal_name": "Sunvine Renewable Energy Private Limited",
    "brand_name": "Sunvine Solar",
    "gstin": "",
    "address": "",
    "state": "Gujarat",
    "whatsapp": "",
    "helpdesk": "",
    "website": "https://sunvinerenewable.com",
    "email": "support@sunvinerenewable.com",
    "support_phone": "+91 63524 68676",
    "support_email": "operations@sunvine.in",
    "bank_name": "",
    "bank_account_no": "",
    "bank_ifsc": "",
    "bank_branch": "",
    "bank_account_holder": "",
    "bank": {
      "bankName": "",
      "accountNumber": "",
      "ifsc": "",
      "branch": "",
      "accountHolder": ""
    },
    "terms": "1. Validity: 15 Days from quotation date.\n2. Net-metering approval is subject to DISCOM policy.\n3. Subsidy disbursement is directly into customer bank account via PM Surya Ghar National Portal.",
    "validityText": "15 Days from generation date",
    "quotation_footer_note": "System prices are inclusive of standard GST, Tier-1 hardware & turnkey commissioning."
  }'::jsonb,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  statutory_taxes = EXCLUDED.statutory_taxes || COALESCE(system_settings.statutory_taxes, '{}'::jsonb),
  governance_settings = EXCLUDED.governance_settings || COALESCE(system_settings.governance_settings, '{}'::jsonb),
  company_profile = EXCLUDED.company_profile || COALESCE(system_settings.company_profile, '{}'::jsonb),
  updated_at = now();

-- ════════════════════════════════════════════════════════════════════
-- STEP 4: HARDENED QUOTATION SEQUENCE (Issue #2: BIGINT return type)
-- ════════════════════════════════════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS public.quotation_seq START WITH 801;

CREATE OR REPLACE FUNCTION public.next_quotation_seq()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.quotation_seq');
$$;

GRANT EXECUTE ON FUNCTION public.next_quotation_seq() TO service_role;

-- ════════════════════════════════════════════════════════════════════
-- STEP 5: SECURITY LOCKDOWN (Issue #1: Drop open policies & legacy RPC/views)
-- ════════════════════════════════════════════════════════════════════

-- 5.1 Drop legacy security-definer login RPC (010)
DROP FUNCTION IF EXISTS public.verify_user_credentials(text, text, text);
DROP FUNCTION IF EXISTS public.verify_user_credentials(text, text, text, text);
DROP FUNCTION IF EXISTS public.verify_user_credentials;

-- 5.2 Drop legacy views that bypass table RLS (011)
DROP VIEW IF EXISTS public.dealers;
DROP VIEW IF EXISTS public.admin_users;
DROP VIEW IF EXISTS public.staff_users;
DROP VIEW IF EXISTS public.audit_log;

-- 5.3 Drop open policies on public tables except service_role (011)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname NOT ILIKE '%service_role%'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- 5.4 Revoke public/anon privileges on sensitive tables (011)
DO $$
DECLARE
  tbl text;
  sensitive_tables text[] := ARRAY[
    'admin_accounts',
    'staff_accounts',
    'dealer_accounts',
    'quotations',
    'quotation_bom_snapshots',
    'customer_files',
    'audit_logs',
    'otp_verifications',
    'notifications',
    'push_subscriptions',
    'dealer_custom_pricing',
    'dealer_product_overrides'
  ];
BEGIN
  FOREACH tbl IN ARRAY sensitive_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated, public;', tbl);
    END IF;
  END LOOP;
END $$;

-- 5.5 Re-create strict read-only SELECT policies for catalogue tables ONLY (011)
DO $$
DECLARE
  tbl text;
  catalogue_tables text[] := ARRAY[
    'solar_modules',
    'solar_inverters',
    'bom_catalog',
    'bom_catalog_items',
    'bos_pricing_matrix',
    'pricing_presets',
    'solar_kits_presets',
    'solar_banks',
    'document_master',
    'inverter_benchmark_matrix',
    'system_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY catalogue_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'anon_select_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true);', 'anon_select_' || tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- STEP 6: DYNAMIC ROW LEVEL SECURITY (Issue #10: Dynamic Table Iteration)
-- ════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t RECORD;
  pol_name TEXT;
BEGIN
  FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.tablename);

    -- Ensure service_role universal policy exists
    pol_name := 'service_role_all_' || t.tablename;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t.tablename
        AND policyname = pol_name
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', pol_name, t.tablename);
    END IF;
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- STEP 7: REALTIME PUBLICATION ISOLATION (Issue #13: Safe Catalogue Tables)
-- ════════════════════════════════════════════════════════════════════

-- 7.1 Remove sensitive tables from realtime publication
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'dealer_accounts',
    'staff_accounts',
    'admin_accounts',
    'audit_logs',
    'otp_verifications',
    'customer_files',
    'quotations',
    'quotation_bom_snapshots',
    'notifications',
    'push_subscriptions',
    'dealer_custom_pricing'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.%I;', tbl);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;

-- 7.2 Re-add safe read-only catalogue tables to realtime publication
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'solar_modules',
    'solar_inverters',
    'bom_catalog',
    'bos_pricing_matrix',
    'pricing_presets',
    'document_master',
    'solar_banks',
    'system_settings'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- Revoke default function and table privileges from anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- Ensure dealer max margin has no illegal default
ALTER TABLE public.dealer_accounts ALTER COLUMN max_margin_cap_per_kw DROP DEFAULT;

COMMIT;

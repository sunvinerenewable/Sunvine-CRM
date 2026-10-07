-- ====================================================================
-- 999_production_master_rollout.sql
-- Sunvine Renewable Energy — Master Production DB Upgrade & Hardening Script
-- Target Database: Production (wyberzvcyrjipjqpotwe)
-- Rollout Safe: 100% Idempotent, Non-Destructive, Preserves Existing Values
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

-- 1.2 quotations columns
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS request_id UUID UNIQUE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;

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

-- ════════════════════════════════════════════════════════════════════
-- STEP 3: SYSTEM SETTINGS NON-DESTRUCTIVE GOVERNANCE MERGE (012)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.system_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global',
    statutory_taxes JSONB NOT NULL DEFAULT '{}'::jsonb,
    governance_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    company_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.system_settings (id, statutory_taxes, governance_settings, company_profile, updated_at)
VALUES (
  'global',
  '{
    "gst_module_rate_pct": 5,
    "gst_inverter_rate_pct": 18,
    "gst_bos_rate_pct": 18,
    "gst_services_rate_pct": 18
  }'::jsonb,
  '{
    "min_margin_per_kw": 3000,
    "max_margin_cap_per_kw": 8000,
    "max_discount_pct": 5,
    "allow_custom_bom_lines": false,
    "bom_rate_tolerance_pct": 10,
    "require_customer_phone": true,
    "require_state_selection": true,
    "quote_validity_days": 30
  }'::jsonb,
  '{
    "company_legal_name": "Sunvine Renewable Energy Private Limited",
    "brand_name": "Sunvine Solar",
    "gstin": "",
    "bank_name": "",
    "bank_account_no": "",
    "bank_ifsc": "",
    "bank_branch": "",
    "registered_address": "",
    "support_phone": "+91 63524 68676",
    "support_email": "operations@sunvine.in",
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
-- STEP 4: HARDENING & SECURITY GRANTS (015)
-- ════════════════════════════════════════════════════════════════════
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Hardened quotation sequence generator with fixed search_path
CREATE OR REPLACE FUNCTION public.next_quotation_seq()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    seq_val bigint;
    seq_str text;
BEGIN
    CREATE SEQUENCE IF NOT EXISTS public.quotation_id_seq START WITH 1;
    seq_val := nextval('public.quotation_id_seq');
    seq_str := 'SNV-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(seq_val::text, 5, '0');
    RETURN seq_str;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_quotation_seq() TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- Ensure no hardcoded margin defaults in dealer table
ALTER TABLE public.dealer_accounts ALTER COLUMN max_margin_cap_per_kw DROP DEFAULT;

-- ════════════════════════════════════════════════════════════════════
-- STEP 5: ROW LEVEL SECURITY VERIFICATION (ALL 23 TABLES)
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bos_pricing_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_custom_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_product_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inverter_benchmark_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_bom_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_inverters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_kits_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

COMMIT;

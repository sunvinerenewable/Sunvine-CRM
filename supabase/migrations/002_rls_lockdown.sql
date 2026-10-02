-- ════════════════════════════════════════════════════════════════════════════
-- Migration 002: RLS Lockdown + Security Hardening (Production Tailored)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- A. DYNAMIC CLEANUP: Drop all existing permissive policies across public schema
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- B. REVOKE sensitive column permissions from anon and authenticated
-- ════════════════════════════════════════════════════════════════════════════
REVOKE SELECT (password_hash) ON public.dealer_accounts FROM anon, authenticated;
REVOKE SELECT (password_hash) ON public.admin_accounts FROM anon, authenticated;
REVOKE SELECT (password_hash) ON public.staff_accounts FROM anon, authenticated;
REVOKE ALL ON public.otp_verifications FROM anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- C. ENABLE RLS on all 18 production base tables
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.solar_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_inverters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inverter_benchmark_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bos_pricing_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_custom_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_kits_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════
-- D. SCHEMA ENHANCEMENTS & CONSTRAINTS (Prior to Policy Creation)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS share_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_share_token ON public.quotations(share_token)
  WHERE share_token IS NOT NULL;

-- Backfill share_token for existing quotations
UPDATE public.quotations
SET share_token = md5(id || clock_timestamp()::text || random()::text)
WHERE share_token IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_capacity_positive') THEN
    ALTER TABLE public.quotations ADD CONSTRAINT chk_capacity_positive CHECK (system_capacity_kw > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_status_enum') THEN
    ALTER TABLE public.quotations ADD CONSTRAINT chk_status_enum CHECK (status IN ('Draft','Pending','Approved','Rejected','Archived','Active / Sent','Approved / Direct','Pending Inspection','Commissioned'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_dealer_status_enum') THEN
    ALTER TABLE public.dealer_accounts ADD CONSTRAINT chk_dealer_status_enum CHECK (status IN ('active','inactive','pending','suspended'));
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- E. NEW POLICIES: Service-Role Only for Sensitive Data & Business Logic
-- ════════════════════════════════════════════════════════════════════════════

-- Sensitive Tables: service_role only
CREATE POLICY "service_role_all_admin_accounts" ON public.admin_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_dealer_accounts" ON public.dealer_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_staff_accounts" ON public.staff_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_customer_files" ON public.customer_files
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_otp" ON public.otp_verifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_audit_logs" ON public.audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_notifications" ON public.notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Quotations: service_role full management + read by share_token
CREATE POLICY "service_role_all_quotations" ON public.quotations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_by_share_token" ON public.quotations
  FOR SELECT TO anon, authenticated
  USING (share_token IS NOT NULL);

-- Catalog Tables: Public read-only for product displays, service_role for updates
CREATE POLICY "public_read_solar_modules" ON public.solar_modules
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_role_all_solar_modules" ON public.solar_modules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_solar_inverters" ON public.solar_inverters
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_role_all_solar_inverters" ON public.solar_inverters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_inverter_benchmark" ON public.inverter_benchmark_matrix
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_role_all_inverter_benchmark" ON public.inverter_benchmark_matrix
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_bom_catalog" ON public.bom_catalog
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_role_all_bom_catalog" ON public.bom_catalog
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_bos_matrix" ON public.bos_pricing_matrix
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_role_all_bos_matrix" ON public.bos_pricing_matrix
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_dealer_pricing" ON public.dealer_custom_pricing
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_role_all_dealer_pricing" ON public.dealer_custom_pricing
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_solar_kits" ON public.solar_kits_presets
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_role_all_solar_kits" ON public.solar_kits_presets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_pricing_presets" ON public.pricing_presets
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_role_all_pricing_presets" ON public.pricing_presets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_solar_banks" ON public.solar_banks
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_role_all_solar_banks" ON public.solar_banks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_system_settings" ON public.system_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_role_all_system_settings" ON public.system_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════
-- F. STORAGE: sunvine-documents bucket lockdown
-- ════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'sunvine-documents') THEN
    UPDATE storage.buckets SET public = false WHERE id = 'sunvine-documents';
    
    DROP POLICY IF EXISTS "Public Access sunvine-documents" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated Upload sunvine-documents" ON storage.objects;
    DROP POLICY IF EXISTS "service_role_only_storage" ON storage.objects;

    CREATE POLICY "service_role_only_storage" ON storage.objects
      FOR ALL TO service_role
      USING (bucket_id = 'sunvine-documents')
      WITH CHECK (bucket_id = 'sunvine-documents');
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- G. UPDATED_AT TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotations_updated_at ON public.quotations;
CREATE TRIGGER trg_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_dealer_accounts_updated_at ON public.dealer_accounts;
CREATE TRIGGER trg_dealer_accounts_updated_at
  BEFORE UPDATE ON public.dealer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- H. DB SEQUENCE for Quotation IDs
-- ════════════════════════════════════════════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS public.quotation_seq START WITH 1000 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_quotation_seq()
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT nextval('public.quotation_seq');
$$;

COMMIT;

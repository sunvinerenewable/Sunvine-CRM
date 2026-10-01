-- ════════════════════════════════════════════════════════════════════════════
-- Migration 002: RLS Lockdown + Security Hardening
-- 
-- CRITICAL: Apply this AFTER deploying the new /api gateway (api/quotations.js,
--           api/auth/login.js). If applied before, the app will break.
--           See docs/ROLLOUT.md for the exact deployment order.
--
-- STATUS: NOT EXECUTED — review carefully, apply to STAGING first.
-- Apply with: psql $DATABASE_URL -f supabase/migrations/002_rls_lockdown.sql
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- A. REVOKE anon/authenticated access to sensitive columns
-- ════════════════════════════════════════════════════════════════════════════
REVOKE SELECT (password_hash) ON public.dealers FROM anon, authenticated;
REVOKE SELECT (password_hash) ON public.admin_users FROM anon, authenticated;
REVOKE SELECT ON public.otp_verifications FROM anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- B. DROP all existing permissive policies
-- ════════════════════════════════════════════════════════════════════════════

-- quotations
DROP POLICY IF EXISTS "Admin Manage All Quotations" ON public.quotations;
DROP POLICY IF EXISTS "Dealers Manage Own Quotations" ON public.quotations;
DROP POLICY IF EXISTS "Public View Customer Proposals" ON public.quotations;
DROP POLICY IF EXISTS "Public Create Update Quotations" ON public.quotations;
DROP POLICY IF EXISTS "Public Manage Quotations" ON public.quotations;
DROP POLICY IF EXISTS "Public Read Quotations" ON public.quotations;

-- dealers
DROP POLICY IF EXISTS "Public Read Active Dealers" ON public.dealers;
DROP POLICY IF EXISTS "Dealers Self Manage" ON public.dealers;
DROP POLICY IF EXISTS "Admin Full Dealer Manage" ON public.dealers;

-- admin_users
DROP POLICY IF EXISTS "Admin Secure Access" ON public.admin_users;

-- customer_files
DROP POLICY IF EXISTS "Admin Manage Customer Files" ON public.customer_files;
DROP POLICY IF EXISTS "Staff Manage Assigned Files" ON public.customer_files;
DROP POLICY IF EXISTS "Dealers Access Sourced Files" ON public.customer_files;

-- otp_verifications
DROP POLICY IF EXISTS "OTP Verification Service" ON public.otp_verifications;

-- solar catalog
DROP POLICY IF EXISTS "Public Read Solar Modules" ON public.solar_modules;
DROP POLICY IF EXISTS "Admin Write Solar Modules" ON public.solar_modules;
DROP POLICY IF EXISTS "Public Read Solar Inverters" ON public.solar_inverters;
DROP POLICY IF EXISTS "Admin Write Solar Inverters" ON public.solar_inverters;

-- storage
DROP POLICY IF EXISTS "Public Access sunvine-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload sunvine-documents" ON storage.objects;

-- ════════════════════════════════════════════════════════════════════════════
-- C. ENABLE RLS on all tables (incl. tables missing from original schema)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_inverters ENABLE ROW LEVEL SECURITY;

-- Enable RLS on tables that were missing from original schema
-- (run IF EXISTS to be safe in case they don't exist yet)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='inverter_benchmark_matrix') THEN
    ALTER TABLE public.inverter_benchmark_matrix ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='bom_catalog') THEN
    ALTER TABLE public.bom_catalog ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='dealer_custom_pricing') THEN
    ALTER TABLE public.dealer_custom_pricing ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='kit_presets') THEN
    ALTER TABLE public.kit_presets ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='system_settings') THEN
    ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='audit_log') THEN
    ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='staff_accounts') THEN
    ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- D. NEW POLICIES: service_role only (all business logic via API gateway)
--    The browser anon key is now useless for data operations.
-- ════════════════════════════════════════════════════════════════════════════

-- quotations: only service_role (our /api gateway)
CREATE POLICY "service_role_only_quotations" ON public.quotations
  FOR ALL USING (auth.role() = 'service_role');

-- dealers: service_role only; no public read of password hashes
CREATE POLICY "service_role_only_dealers" ON public.dealers
  FOR ALL USING (auth.role() = 'service_role');

-- admin_users: service_role only
CREATE POLICY "service_role_only_admin_users" ON public.admin_users
  FOR ALL USING (auth.role() = 'service_role');

-- customer_files: service_role only
CREATE POLICY "service_role_only_customer_files" ON public.customer_files
  FOR ALL USING (auth.role() = 'service_role');

-- otp_verifications: service_role only
CREATE POLICY "service_role_only_otp" ON public.otp_verifications
  FOR ALL USING (auth.role() = 'service_role');

-- solar catalog: read-only for authenticated, write for service_role
CREATE POLICY "service_role_write_solar_modules" ON public.solar_modules
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_write_solar_inverters" ON public.solar_inverters
  FOR ALL USING (auth.role() = 'service_role');

-- Pricing/BOM/kit tables: service_role only
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='inverter_benchmark_matrix') THEN
    EXECUTE 'CREATE POLICY "service_role_only_inverter_matrix" ON public.inverter_benchmark_matrix FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='bom_catalog') THEN
    EXECUTE 'CREATE POLICY "service_role_only_bom_catalog" ON public.bom_catalog FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='dealer_custom_pricing') THEN
    EXECUTE 'CREATE POLICY "service_role_only_dealer_pricing" ON public.dealer_custom_pricing FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='kit_presets') THEN
    EXECUTE 'CREATE POLICY "service_role_only_kit_presets" ON public.kit_presets FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='system_settings') THEN
    EXECUTE 'CREATE POLICY "service_role_only_system_settings" ON public.system_settings FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='audit_log') THEN
    EXECUTE 'CREATE POLICY "service_role_only_audit_log" ON public.audit_log FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename='staff_accounts') THEN
    EXECUTE 'CREATE POLICY "service_role_only_staff_accounts" ON public.staff_accounts FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- E. STORAGE: Make sunvine-documents private, no anon uploads
-- ════════════════════════════════════════════════════════════════════════════

-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'sunvine-documents';

-- Remove permissive storage policies
DROP POLICY IF EXISTS "Public Access sunvine-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload sunvine-documents" ON storage.objects;

-- New policy: service_role only (our /api/storage-presign handler uses service key)
CREATE POLICY "service_role_only_storage" ON storage.objects
  FOR ALL USING (
    bucket_id = 'sunvine-documents' AND auth.role() = 'service_role'
  );

-- ════════════════════════════════════════════════════════════════════════════
-- F. ADD MISSING CONSTRAINTS
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.quotations
  ADD CONSTRAINT IF NOT EXISTS chk_capacity_positive CHECK (system_capacity_kw > 0),
  ADD CONSTRAINT IF NOT EXISTS chk_base_cost_positive CHECK (base_cost >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_dealer_margin_positive CHECK (dealer_margin >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_total_amount_positive CHECK (total_amount >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_net_payable_positive CHECK (net_payable >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_status_enum CHECK (status IN ('Draft','Pending','Approved','Rejected','Archived'));

ALTER TABLE public.dealers
  ADD CONSTRAINT IF NOT EXISTS chk_dealer_status_enum CHECK (status IN ('active','inactive','suspended'));

-- ════════════════════════════════════════════════════════════════════════════
-- G. ADD SHARE TOKEN COLUMN for public proposal links
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS share_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_share_token ON public.quotations(share_token)
  WHERE share_token IS NOT NULL;

-- Backfill share_token for existing quotations
UPDATE public.quotations
SET share_token = encode(gen_random_bytes(18), 'base64url')
WHERE share_token IS NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- H. UPDATED_AT TRIGGER
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

DROP TRIGGER IF EXISTS trg_dealers_updated_at ON public.dealers;
CREATE TRIGGER trg_dealers_updated_at
  BEFORE UPDATE ON public.dealers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- I. DB SEQUENCE for quotation IDs
-- ════════════════════════════════════════════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS public.quotation_seq START WITH 1000 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_quotation_seq()
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT nextval('public.quotation_seq');
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- J. REMOVE DEMO CREDENTIALS from schema (these should not be in production)
-- ════════════════════════════════════════════════════════════════════════════
-- MANUAL: Delete demo seed data that was inserted by supabase_schema.sql
-- Run after applying this migration:
--   DELETE FROM public.dealers WHERE dealer_code = 'SV-DLR-0104' AND firm_name = 'Sunline Solar Solutions';
--   DELETE FROM public.admin_users WHERE email = 'admin@sunvinerenewable.com' AND full_name = 'Super Administrator';
-- Then use scripts/createAccount.mjs to create real accounts with strong passwords.

COMMIT;

-- Verification queries (run after applying):
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT schemaname, tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public';
-- \d storage.buckets  -- confirm public = false for sunvine-documents

-- ════════════════════════════════════════════════════════════════════════════
-- Migration 011: Comprehensive RLS Lockdown & Anon Revocation V2
-- Fixes: SEC-002, SEC-004, SEC-008, BUG-06 (Eliminates 11 Anon Leak Violations)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Ensure required tables exist ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_master (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key TEXT UNIQUE,
  label TEXT,
  category TEXT,
  description TEXT,
  icon TEXT,
  allowed_extensions JSONB DEFAULT '[]'::jsonb,
  rules JSONB DEFAULT '{}'::jsonb,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.quotation_bom_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id TEXT,
  bom_data JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ── 2. Unconditionally DROP ALL existing policies except service_role ────────
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

-- ── 3. Drop legacy views that bypass table RLS ──────────────────────────────
DROP VIEW IF EXISTS public.dealers;
DROP VIEW IF EXISTS public.admin_users;
DROP VIEW IF EXISTS public.staff_users;
DROP VIEW IF EXISTS public.audit_log;

-- ── 4. Remove all sensitive tables from Realtime Publication ────────────────
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
    'dealer_custom_pricing',
    'inverter_benchmark_matrix',
    'system_settings',
    'solar_kits_presets',
    'solar_banks',
    'document_master',
    'dealer_accounts',
    'staff_accounts',
    'admin_accounts',
    'audit_logs',
    'otp_verifications',
    'customer_files',
    'quotations',
    'quotation_bom_snapshots',
    'notifications',
    'push_subscriptions'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.%I', tbl);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;

-- ── 5. Enable Row Level Security across ALL public tables ────────────────────
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- ── 6. Create universal service_role policies ────────────────────────────────
DO $$
DECLARE
  t RECORD;
  pol_name TEXT;
BEGIN
  FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    pol_name := 'service_role_all_' || t.tablename;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t.tablename
        AND policyname = pol_name
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', pol_name, t.tablename);
    END IF;
  END LOOP;
END $$;

-- ── 7. REVOKE ALL privileges on sensitive tables from anon, authenticated, public
REVOKE ALL ON public.dealer_accounts FROM anon, authenticated, public;
REVOKE ALL ON public.staff_accounts FROM anon, authenticated, public;
REVOKE ALL ON public.admin_accounts FROM anon, authenticated, public;
REVOKE ALL ON public.audit_logs FROM anon, authenticated, public;
REVOKE ALL ON public.otp_verifications FROM anon, authenticated, public;
REVOKE ALL ON public.customer_files FROM anon, authenticated, public;
REVOKE ALL ON public.notifications FROM anon, authenticated, public;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated, public;
REVOKE ALL ON public.quotations FROM anon, authenticated, public;
REVOKE ALL ON public.quotation_bom_snapshots FROM anon, authenticated, public;
REVOKE ALL ON public.system_settings FROM anon, authenticated, public;
REVOKE ALL ON public.dealer_custom_pricing FROM anon, authenticated, public;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'solar_banks') THEN
    EXECUTE 'REVOKE ALL ON public.solar_banks FROM anon, authenticated, public';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'solar_kits_presets') THEN
    EXECUTE 'REVOKE ALL ON public.solar_kits_presets FROM anon, authenticated, public';
  END IF;
END $$;

-- ── 8. Re-create strict read-only SELECT policies on catalogue tables ONLY ───
CREATE POLICY "anon_select_solar_modules" ON public.solar_modules
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_select_solar_inverters" ON public.solar_inverters
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_select_bom_catalog" ON public.bom_catalog
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_select_bos_pricing_matrix" ON public.bos_pricing_matrix
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_select_pricing_presets" ON public.pricing_presets
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_select_document_master" ON public.document_master
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_select_inverter_benchmark_matrix" ON public.inverter_benchmark_matrix
  FOR SELECT TO anon, authenticated USING (true);

-- ── 9. Grant read-only & Revoke write mutations on catalogue tables ──────────
GRANT SELECT ON public.solar_modules TO anon, authenticated;
GRANT SELECT ON public.solar_inverters TO anon, authenticated;
GRANT SELECT ON public.bom_catalog TO anon, authenticated;
GRANT SELECT ON public.bos_pricing_matrix TO anon, authenticated;
GRANT SELECT ON public.pricing_presets TO anon, authenticated;
GRANT SELECT ON public.document_master TO anon, authenticated;
GRANT SELECT ON public.inverter_benchmark_matrix TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.solar_modules FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON public.solar_inverters FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON public.bom_catalog FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON public.bos_pricing_matrix FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON public.pricing_presets FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON public.document_master FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON public.inverter_benchmark_matrix FROM anon, authenticated, public;

COMMIT;

-- ============================================================================
-- Migration 015: Security Hardening, Search Path Lockdown & Privilege Revocation
-- ============================================================================
--
-- ROLLOUT SEQUENCE & DEPLOYMENT INSTRUCTIONS:
-- ----------------------------------------------------------------------------
-- Phase 1 (Pre-Deployment):
--   1. 000_align_columns.sql
--   2. 012_governance_defaults.sql
--   3. 013_quotation_request_id_share_tokens_indexes.sql
--   4. 014_numeric_price_columns_backfill.sql
--
-- Phase 2 (Code Deployment):
--   Deploy updated backend APIs and frontend code bundle to production.
--
-- Phase 3 (Post-Deployment Hardening):
--   5. 011_rls_lockdown_v2.sql
--   6. 010_drop_verify_user_credentials.sql
--   7. 015_hardening.sql (this migration)
-- ============================================================================

-- 1. Revoke default public execution privileges on all functions in schema public
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- 2. Ensure sequence exists and recreate next_quotation_seq with pinned search_path
CREATE SEQUENCE IF NOT EXISTS public.quotation_sequence START WITH 1001 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_quotation_seq()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.quotation_sequence');
$$;

-- Grant EXECUTE strictly to service_role (backend worker only)
GRANT EXECUTE ON FUNCTION public.next_quotation_seq() TO service_role;
REVOKE EXECUTE ON FUNCTION public.next_quotation_seq() FROM PUBLIC, anon, authenticated;

-- 3. Default privileges lockdown: prevent automatic grants to anon / public on new objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- 4. Drop hardcoded margin default on dealer accounts (enforces explicit margin configuration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'dealer_accounts' 
      AND column_name = 'max_margin_cap_per_kw'
  ) THEN
    ALTER TABLE public.dealer_accounts ALTER COLUMN max_margin_cap_per_kw DROP DEFAULT;
  END IF;
END $$;

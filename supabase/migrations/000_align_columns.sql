-- ════════════════════════════════════════════════════════════════════════════
-- Migration 000: Align all core schema columns across all tables
-- Ensures all columns referenced by services, auth, and migrations exist.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. quotations ────────────────────────────────────────────────────────────
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS quote_payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS request_id UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;

-- ── 2. staff_accounts ────────────────────────────────────────────────────────
ALTER TABLE public.staff_accounts
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'sales',
  ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(15),
  ADD COLUMN IF NOT EXISTS is_verification BOOLEAN DEFAULT false;

-- ── 3. dealer_accounts ───────────────────────────────────────────────────────
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS assigned_staff_id VARCHAR(50) DEFAULT 'STF-DIRECT',
  ADD COLUMN IF NOT EXISTS assigned_staff_name VARCHAR(255) DEFAULT 'Direct to Company (HQ Desk)',
  ADD COLUMN IF NOT EXISTS max_margin_cap_per_kw NUMERIC(10,2) DEFAULT 6000.00,
  ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'Gold EPC';

-- ── 4. admin_accounts ────────────────────────────────────────────────────────
ALTER TABLE public.admin_accounts
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(15),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- ── 5. customer_files ────────────────────────────────────────────────────────
ALTER TABLE public.customer_files
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Gujarat',
  ADD COLUMN IF NOT EXISTS system_kw NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS discom_application_no VARCHAR(100);

-- Backfill system_kw from solar_system_kw if null
UPDATE public.customer_files
SET system_kw = solar_system_kw
WHERE system_kw IS NULL AND solar_system_kw IS NOT NULL;

-- ── 6. audit_logs ────────────────────────────────────────────────────────────
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- ── 7. Sequences & RPCs ──────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.quotation_seq START WITH 801;

CREATE OR REPLACE FUNCTION public.next_quotation_seq()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT nextval('public.quotation_seq');
$$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- Migration 013: Quotation Request ID, Share Token Expiry & Performance Indexes
-- Directives: BUG-05, SEC-018, BUG-04
--
-- This migration:
-- 1. Adds request_id UUID (UNIQUE) to quotations for idempotent quote generation (BUG-05).
-- 2. Adds share_expires_at TIMESTAMPTZ to quotations for time-limited share links (SEC-018).
-- 3. Adds compound index idx_quotations_dealer_created on (dealer_id, created_at DESC) (BUG-04).
-- 4. Adds compound index idx_customer_files_dealer_status on (dealer_id, status) (BUG-04).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Quotations Schema Enhancements ────────────────────────────────────────
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS request_id UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;

-- ── 2. Performance & Idempotency Indexes ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quotations_dealer_created
  ON public.quotations (dealer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_files_dealer_status
  ON public.customer_files (dealer_id, status);

CREATE INDEX IF NOT EXISTS idx_quotations_request_id
  ON public.quotations (request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_share_expires_at
  ON public.quotations (share_expires_at)
  WHERE share_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_share_token
  ON public.quotations (share_token)
  WHERE share_token IS NOT NULL;

COMMIT;

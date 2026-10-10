-- ============================================================================
-- pending_migrations_2026-10-08.sql
-- Missing migrations required for Staging / Dev environment
--
-- COVERAGE SUMMARY:
-- - Migration 018 (customer_files_slack_thread.sql):
--     * ADD COLUMN slack_channel text
--     * ADD COLUMN slack_ts text
--     * CREATE INDEX idx_customer_files_slack_ts
--
-- SKIPPED AS ALREADY APPLIED IN TARGET DATABASE:
-- - 000_align_columns.sql: Already applied (system_kw, quotation_seq exist).
-- - 001_numeric_prices.sql / 014_numeric_price_columns_backfill.sql: Already applied (rate_per_wp_inr, base_price_inr exist).
-- - 002_rls_lockdown.sql & 011_rls_lockdown_v2.sql: Already applied (RLS active, document_master, quotation_bom_snapshots exist).
-- - 003_staff_and_dealer_sync.sql: Already applied (staff columns exist).
-- - 004_dealer_salesman_attribution.sql: Already applied (assigned_staff_id exists).
-- - 005_push_subscriptions.sql: Already applied (push_subscriptions table exists).
-- - 008_cancelled_files_14_day_retention.sql: Already applied (purge function and index exist).
-- - 009_audit_logs_comprehensive_schema_and_rls.sql: Already applied (audit_logs table and module column exist).
-- - 010_drop_verify_user_credentials.sql: Already applied (legacy function dropped).
-- - 012_governance_defaults.sql: Already applied (system_settings, solar_banks exist).
-- - 013_quotation_request_id_share_tokens_indexes.sql: Already applied (share token indexes exist).
-- - 015_hardening.sql: Skipped (production-specific privilege revocation; public sequence quotation_seq is already active).
-- - 016_staging_parity.sql: Already applied (bom_catalog_items, solar_kits_presets exist).
-- - 017_seed_missing_tables.sql: Already applied (document_master has 20 active rows).
-- ============================================================================

BEGIN;

-- ── 1. Slack thread sync columns on customer_files ──────────────────────────
ALTER TABLE public.customer_files
  ADD COLUMN IF NOT EXISTS slack_channel text,
  ADD COLUMN IF NOT EXISTS slack_ts text;

-- ── 2. Index for fast lookup by slack_ts ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customer_files_slack_ts
  ON public.customer_files (slack_ts)
  WHERE slack_ts IS NOT NULL;

COMMIT;

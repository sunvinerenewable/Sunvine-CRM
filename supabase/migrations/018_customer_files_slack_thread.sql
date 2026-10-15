-- ====================================================================
-- 018_customer_files_slack_thread.sql
-- Add Slack channel and message timestamp (slack_ts) to customer_files
-- for single-message thread syncing via Slack Web API
-- Rollout Safe: 100% Idempotent, Non-Destructive, Preserves Existing Values
-- ====================================================================

BEGIN;

ALTER TABLE public.customer_files
  ADD COLUMN IF NOT EXISTS slack_channel text,
  ADD COLUMN IF NOT EXISTS slack_ts text;

-- Index to quickly look up files by slack_ts if needed
CREATE INDEX IF NOT EXISTS idx_customer_files_slack_ts ON public.customer_files (slack_ts) WHERE slack_ts IS NOT NULL;

COMMIT;

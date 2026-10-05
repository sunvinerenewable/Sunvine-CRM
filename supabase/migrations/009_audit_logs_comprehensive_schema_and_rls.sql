-- Migration 009: Comprehensive Audit Logs Schema & RLS Lockdown
-- Fixes HTTP 400 Bad Request issues by adding all needed columns, adjusting constraints, and opening insert RLS

-- 1. Add missing audit columns if they don't exist
ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS module VARCHAR(100),
  ADD COLUMN IF NOT EXISTS record_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS user_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS role VARCHAR(100),
  ADD COLUMN IF NOT EXISTS old_value JSONB,
  ADD COLUMN IF NOT EXISTS new_value JSONB,
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'VERIFIED',
  ADD COLUMN IF NOT EXISTS table_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS actor_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS actor_role VARCHAR(100);

-- 2. Ensure constraints allow flexible event logging
ALTER TABLE public.audit_logs ALTER COLUMN entity_type DROP NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN entity_type SET DEFAULT 'GENERAL';
ALTER TABLE public.audit_logs ALTER COLUMN action DROP NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN action SET DEFAULT 'SYSTEM_ACTION';
ALTER TABLE public.audit_logs ALTER COLUMN details SET DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_logs ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());

-- 3. Indexes for fast audit retrieval and filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs (module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs (record_id);

-- 4. Enable RLS and add Permissive INSERT / SELECT Policies for anon, authenticated, and service_role
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_audit_logs" ON public.audit_logs;
CREATE POLICY "service_role_all_audit_logs" ON public.audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "allow_insert_audit_logs" ON public.audit_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "allow_select_audit_logs" ON public.audit_logs;
CREATE POLICY "allow_select_audit_logs" ON public.audit_logs
  FOR SELECT TO anon, authenticated USING (true);

-- 5. Create compatibility view for singular 'audit_log'
CREATE OR REPLACE VIEW public.audit_log AS SELECT * FROM public.audit_logs;

-- Migration: 005_push_subscriptions.sql
-- Creates push_subscriptions table for Web Push (VAPID) OS-level notifications

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid lookup by recipient and endpoint
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_role ON public.push_subscriptions(role);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- Enable Row Level Security
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'push_subscriptions' AND policyname = 'service_role_all_push_subs'
  ) THEN
    CREATE POLICY service_role_all_push_subs 
      ON public.push_subscriptions 
      FOR ALL 
      TO service_role 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

-- Migration 008: 14-Day Cancellation Retention & Auto-Cleanup
-- Ensures cancellation tracking columns, retention indexes, and auto-purge procedure

-- 1. Ensure columns exist on public.customer_files
ALTER TABLE public.customer_files 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- 2. Index for fast 14-day retention queries
CREATE INDEX IF NOT EXISTS idx_customer_files_cancelled_retention 
ON public.customer_files (status, cancelled_at) 
WHERE status = 'Cancelled';

-- 3. Database Procedure to clear document records after 14 days
CREATE OR REPLACE FUNCTION purge_expired_cancelled_file_documents()
RETURNS INTEGER AS $$
DECLARE
    purged_count INTEGER;
BEGIN
    UPDATE public.customer_files
    SET documents = '{}'::jsonb,
        updated_at = NOW()
    WHERE status = 'Cancelled'
      AND cancelled_at IS NOT NULL
      AND cancelled_at < NOW() - INTERVAL '14 days'
      AND documents IS NOT NULL
      AND documents::text != '{}'
      AND documents::text != 'null';
    
    GET DIAGNOSTICS purged_count = ROW_COUNT;
    RETURN purged_count;
END;
$$ LANGUAGE plpgsql;

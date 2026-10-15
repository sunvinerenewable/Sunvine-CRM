-- Migration 020: Customer Files Verification Lock & 14-Day Trash Lifecycle
-- Ensures columns for verification status and soft-delete retention tracking

-- 1. Add verification and soft delete columns to public.customer_files
ALTER TABLE public.customer_files 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by TEXT,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- 2. Indexes for fast active queries and 14-day trash purge queries
CREATE INDEX IF NOT EXISTS idx_customer_files_is_deleted_active
ON public.customer_files (is_deleted, created_at DESC)
WHERE is_deleted IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_customer_files_trash_retention 
ON public.customer_files (is_deleted, deleted_at) 
WHERE is_deleted = TRUE;

CREATE INDEX IF NOT EXISTS idx_customer_files_verification 
ON public.customer_files (is_verified) 
WHERE is_verified = TRUE;

-- 3. Procedure to permanently delete soft-deleted files past 14 days
CREATE OR REPLACE FUNCTION purge_expired_trash_customer_files()
RETURNS INTEGER AS $$
DECLARE
    purged_count INTEGER;
BEGIN
    DELETE FROM public.customer_files
    WHERE is_deleted = TRUE
      AND deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '14 days';
    
    GET DIAGNOSTICS purged_count = ROW_COUNT;
    RETURN purged_count;
END;
$$ LANGUAGE plpgsql;

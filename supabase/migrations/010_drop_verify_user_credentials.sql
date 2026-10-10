-- Migration 010: Drop verify_user_credentials RPC (SEC-003)
-- 
-- IMPORTANT: Run first on staging, then production after a full pg_dump backup.
-- This removes the legacy SECURITY DEFINER login RPC.
-- All authentication must route solely through /api/auth/login with server-side bcrypt.

-- 1. Read-only diagnostic check: verify if the function exists and whether it contains hardcoded passwords
SELECT proname, prosrc ~ 'p_password\s*=' AS has_hardcoded_pw 
FROM pg_proc 
WHERE proname = 'verify_user_credentials';

-- 2. Drop the function with all argument signatures
DROP FUNCTION IF EXISTS public.verify_user_credentials(text, text, text);
DROP FUNCTION IF EXISTS public.verify_user_credentials(text, text, text, text);
DROP FUNCTION IF EXISTS public.verify_user_credentials;

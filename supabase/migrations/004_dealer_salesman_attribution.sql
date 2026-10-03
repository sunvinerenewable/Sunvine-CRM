-- ==============================================================================
-- Sunvine Solar EPC - Migration 004: Dealer Salesman & Company Attribution
-- ==============================================================================

-- 1. Standardize column defaults on public.dealer_accounts
-- Every dealer belongs to either a field salesman (staff_accounts.id) 
-- or Direct to Company (STF-DIRECT / HQ Desk) by default.
ALTER TABLE public.dealer_accounts 
    ALTER COLUMN assigned_staff_id SET DEFAULT 'STF-DIRECT',
    ALTER COLUMN assigned_staff_name SET DEFAULT 'Direct to Company (HQ Desk)';

-- 2. Clean up any existing records with legacy test staff IDs or NULLs
-- Specifically update known dealer 1 (SV-DLR-0851) to mayank vekariya (STF-802) as configured in pricing_config
UPDATE public.dealer_accounts
SET 
    assigned_staff_id = 'STF-802',
    assigned_staff_name = 'mayank vekariya',
    pricing_config = jsonb_set(
        COALESCE(pricing_config, '{}'::jsonb), 
        '{assignedStaffId}', 
        '"STF-802"'
    ),
    updated_at = NOW()
WHERE dealer_code = 'SV-DLR-0851';

-- Update xx solar (SV-DLR-8000) to Sunvine Sales Staff (STF-801)
UPDATE public.dealer_accounts
SET 
    assigned_staff_id = 'STF-801',
    assigned_staff_name = 'Sunvine Sales Staff',
    pricing_config = jsonb_build_object(
        'assignedStaffId', 'STF-801',
        'assignedStaffName', 'Sunvine Sales Staff'
    ),
    updated_at = NOW()
WHERE dealer_code = 'SV-DLR-8000';

-- Catch-all: Ensure any other legacy 'STF-001' or NULL dealers default to Direct to Company
UPDATE public.dealer_accounts
SET 
    assigned_staff_id = 'STF-DIRECT',
    assigned_staff_name = 'Direct to Company (HQ Desk)',
    updated_at = NOW()
WHERE assigned_staff_id = 'STF-001' 
   OR assigned_staff_id IS NULL 
   OR assigned_staff_id = '';

-- 3. Update staff_accounts metrics based on current live dealer assignments
UPDATE public.staff_accounts s
SET 
    dealers_count = (
        SELECT COUNT(*) 
        FROM public.dealer_accounts d 
        WHERE d.assigned_staff_id = s.id
    ),
    updated_at = NOW();

-- ==============================================================================
-- Sunvine Solar EPC - Migration 003: Staff & Dealer Accounts Database Sync
-- ==============================================================================

-- 1. Ensure staff_accounts table structure with complete column definition
CREATE TABLE IF NOT EXISTS public.staff_accounts (
    id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL DEFAULT 'sales',
    phone VARCHAR(20),
    mobile_number VARCHAR(15) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    zone VARCHAR(255) DEFAULT 'Gujarat',
    city VARCHAR(100) DEFAULT 'Ahmedabad',
    status VARCHAR(50) DEFAULT 'active',
    dealers_count INTEGER DEFAULT 0,
    direct_files_count INTEGER DEFAULT 0,
    dealer_files_count INTEGER DEFAULT 0,
    pipeline_kw NUMERIC(10,2) DEFAULT 0,
    rating NUMERIC(3,2) DEFAULT 4.9,
    onboarded_date VARCHAR(30) DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD'),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add any missing columns to existing staff_accounts if already created
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'phone') THEN
        ALTER TABLE public.staff_accounts ADD COLUMN phone VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'mobile_number') THEN
        ALTER TABLE public.staff_accounts ADD COLUMN mobile_number VARCHAR(15);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'department') THEN
        ALTER TABLE public.staff_accounts ADD COLUMN department VARCHAR(50) NOT NULL DEFAULT 'sales';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'dealers_count') THEN
        ALTER TABLE public.staff_accounts ADD COLUMN dealers_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'direct_files_count') THEN
        ALTER TABLE public.staff_accounts ADD COLUMN direct_files_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'dealer_files_count') THEN
        ALTER TABLE public.staff_accounts ADD COLUMN dealer_files_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'pipeline_kw') THEN
        ALTER TABLE public.staff_accounts ADD COLUMN pipeline_kw NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'rating') THEN
        ALTER TABLE public.staff_accounts ADD COLUMN rating NUMERIC(3,2) DEFAULT 4.9;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'onboarded_date') THEN
        ALTER TABLE public.staff_accounts ADD COLUMN onboarded_date VARCHAR(30) DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD');
    END IF;
END $$;

-- 3. Populate mobile_number from phone if mobile_number is NULL
UPDATE public.staff_accounts
SET mobile_number = phone
WHERE mobile_number IS NULL AND phone IS NOT NULL;

UPDATE public.staff_accounts
SET phone = mobile_number
WHERE phone IS NULL AND mobile_number IS NOT NULL;

-- 4. Enable Row-Level Security (RLS) and policies for staff_accounts
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read staff_accounts" ON public.staff_accounts;
DROP POLICY IF EXISTS "Public write staff_accounts" ON public.staff_accounts;
DROP POLICY IF EXISTS "Allow select staff_accounts" ON public.staff_accounts;
DROP POLICY IF EXISTS "Allow modify staff_accounts" ON public.staff_accounts;

CREATE POLICY "Allow select staff_accounts" ON public.staff_accounts 
    FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Allow modify staff_accounts" ON public.staff_accounts 
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- 5. Seed default staff accounts if not present (Bcrypt hash for 'Sunvine@2026')
INSERT INTO public.staff_accounts (
    id, name, role, department, phone, mobile_number, email, password_hash, zone, city, status
) VALUES 
(
    'STF-800',
    'Sunvine Verification Officer',
    'Field Verification Officer',
    'verification',
    '8000050580',
    '8000050580',
    'desk800@sunvine.in',
    '$2a$10$R773lJ4Z39x.n5q.6V6Eme1Z7z6J3M9j71oM.Qj7g7q3f1m2G6mGy',
    'Gujarat Verification Desk',
    'Ahmedabad',
    'active'
),
(
    'STF-801',
    'Sunvine Sales Staff',
    'Senior Solar Field Executive',
    'sales',
    '8000050580',
    '8000050580',
    'sales800@sunvine.in',
    '$2a$10$R773lJ4Z39x.n5q.6V6Eme1Z7z6J3M9j71oM.Qj7g7q3f1m2G6mGy',
    'Gujarat Sales Desk',
    'Ahmedabad',
    'active'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    phone = EXCLUDED.phone,
    mobile_number = EXCLUDED.mobile_number,
    zone = EXCLUDED.zone,
    city = EXCLUDED.city,
    status = EXCLUDED.status,
    updated_at = NOW();

-- 6. Ensure dealer_accounts has assigned_staff_id and assigned_staff_name columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dealer_accounts' AND column_name = 'assigned_staff_id') THEN
        ALTER TABLE public.dealer_accounts ADD COLUMN assigned_staff_id VARCHAR(50) DEFAULT 'STF-DIRECT';
    ELSE
        ALTER TABLE public.dealer_accounts ALTER COLUMN assigned_staff_id SET DEFAULT 'STF-DIRECT';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dealer_accounts' AND column_name = 'assigned_staff_name') THEN
        ALTER TABLE public.dealer_accounts ADD COLUMN assigned_staff_name VARCHAR(255) DEFAULT 'Direct to Company (HQ Desk)';
    ELSE
        ALTER TABLE public.dealer_accounts ALTER COLUMN assigned_staff_name SET DEFAULT 'Direct to Company (HQ Desk)';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dealer_accounts' AND column_name = 'pricing_config') THEN
        ALTER TABLE public.dealer_accounts ADD COLUMN pricing_config JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 7. Ensure dealer_accounts RLS policies allow admin operations
ALTER TABLE public.dealer_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select dealer_accounts" ON public.dealer_accounts;
DROP POLICY IF EXISTS "Allow modify dealer_accounts" ON public.dealer_accounts;

CREATE POLICY "Allow select dealer_accounts" ON public.dealer_accounts 
    FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Allow modify dealer_accounts" ON public.dealer_accounts 
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

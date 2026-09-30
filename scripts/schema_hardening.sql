-- ====================================================================
-- SUNVINE ENTERPRISE DATABASE SCHEMA & SECURITY HARDENING
-- Pgcrypto bcrypt hashing, Secure Authentication RPCs, Unified Master Data
-- ====================================================================

-- 1. Enable pgcrypto extension for bcrypt and cryptographic primitives
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL DEFAULT 'Super Administrator',
    role VARCHAR(50) NOT NULL DEFAULT 'super_admin',
    password_hash TEXT NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. DEALERS TABLE
CREATE TABLE IF NOT EXISTS public.dealers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_code VARCHAR(30) UNIQUE NOT NULL,
    firm_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Gujarat',
    city VARCHAR(100) NOT NULL DEFAULT 'Ahmedabad',
    discom VARCHAR(100) NOT NULL DEFAULT 'UGVCL',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    rating NUMERIC(2,1) DEFAULT 4.9,
    tier VARCHAR(50) DEFAULT 'Gold EPC',
    total_commissioned_mw NUMERIC(6,2) DEFAULT 0.0,
    max_margin_cap_per_kw NUMERIC(10,2) DEFAULT 6000.0,
    assigned_staff_id VARCHAR(50) DEFAULT 'STF-001',
    assigned_staff_name VARCHAR(255) DEFAULT 'Jayesh Patel',
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    ifsc_code VARCHAR(50),
    branch VARCHAR(255),
    pan_number VARCHAR(50),
    gst_number VARCHAR(50),
    pricing_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add missing columns to dealers if table already existed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dealers' AND column_name='tier') THEN
        ALTER TABLE public.dealers ADD COLUMN tier VARCHAR(50) DEFAULT 'Gold EPC';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dealers' AND column_name='max_margin_cap_per_kw') THEN
        ALTER TABLE public.dealers ADD COLUMN max_margin_cap_per_kw NUMERIC(10,2) DEFAULT 6000.0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dealers' AND column_name='assigned_staff_id') THEN
        ALTER TABLE public.dealers ADD COLUMN assigned_staff_id VARCHAR(50) DEFAULT 'STF-001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dealers' AND column_name='assigned_staff_name') THEN
        ALTER TABLE public.dealers ADD COLUMN assigned_staff_name VARCHAR(255) DEFAULT 'Jayesh Patel';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dealers' AND column_name='bank_name') THEN
        ALTER TABLE public.dealers ADD COLUMN bank_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dealers' AND column_name='account_number') THEN
        ALTER TABLE public.dealers ADD COLUMN account_number VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dealers' AND column_name='ifsc_code') THEN
        ALTER TABLE public.dealers ADD COLUMN ifsc_code VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dealers' AND column_name='branch') THEN
        ALTER TABLE public.dealers ADD COLUMN branch VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dealers' AND column_name='pan_number') THEN
        ALTER TABLE public.dealers ADD COLUMN pan_number VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dealers' AND column_name='gst_number') THEN
        ALTER TABLE public.dealers ADD COLUMN gst_number VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dealers' AND column_name='pricing_config') THEN
        ALTER TABLE public.dealers ADD COLUMN pricing_config JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 4. STAFF USERS TABLE
CREATE TABLE IF NOT EXISTS public.staff_users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    zone VARCHAR(255),
    city VARCHAR(100) DEFAULT 'Ahmedabad',
    department VARCHAR(100) DEFAULT 'Sales',
    status VARCHAR(50) DEFAULT 'Active',
    onboarded_date VARCHAR(50) DEFAULT '2026-01-10',
    dealers_count INTEGER DEFAULT 0,
    direct_files_count INTEGER DEFAULT 0,
    dealer_files_count INTEGER DEFAULT 0,
    pipeline_kw NUMERIC(8,2) DEFAULT 0.0,
    rating NUMERIC(2,1) DEFAULT 4.9,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_users' AND column_name='password_hash') THEN
        ALTER TABLE public.staff_users ADD COLUMN password_hash TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_users' AND column_name='department') THEN
        ALTER TABLE public.staff_users ADD COLUMN department VARCHAR(100) DEFAULT 'Sales';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_users' AND column_name='pipeline_kw') THEN
        ALTER TABLE public.staff_users ADD COLUMN pipeline_kw NUMERIC(8,2) DEFAULT 0.0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_users' AND column_name='rating') THEN
        ALTER TABLE public.staff_users ADD COLUMN rating NUMERIC(2,1) DEFAULT 4.9;
    END IF;
END $$;

-- 5. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS public.quotations (
    id VARCHAR(50) PRIMARY KEY,
    dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
    dealer_code VARCHAR(30),
    dealer_name VARCHAR(255),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_city VARCHAR(100),
    customer_state VARCHAR(100) DEFAULT 'Gujarat',
    system_capacity_kw NUMERIC(6,2) NOT NULL,
    panel_type VARCHAR(100) DEFAULT 'Mono PERC Bi-facial (550W)',
    inverter_type VARCHAR(100) DEFAULT 'Sungrow 5kW Grid-Tie',
    structure_type VARCHAR(100) DEFAULT 'High-Rise Galvanized HDG 2.5m',
    base_cost NUMERIC(12,2) NOT NULL,
    dealer_margin NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL,
    subsidy_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_payable NUMERIC(12,2) NOT NULL,
    annual_generation_kwh NUMERIC(10,2),
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    pdf_url TEXT,
    quote_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. CUSTOMER FILES TABLE (Pipeline, Stage Tracking & Document Vault)
CREATE TABLE IF NOT EXISTS public.customer_files (
    id VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    discom VARCHAR(100),
    consumer_no VARCHAR(100),
    sanctioned_load_kw NUMERIC(6,2),
    solar_system_kw NUMERIC(6,2) NOT NULL,
    roof_type VARCHAR(100),
    source_type VARCHAR(50) DEFAULT 'DIRECT_STAFF',
    dealer_id VARCHAR(50),
    dealer_name VARCHAR(255),
    staff_id VARCHAR(50),
    staff_name VARCHAR(255),
    finance_type VARCHAR(50) DEFAULT 'CASH',
    loan_bank VARCHAR(255),
    loan_account_no VARCHAR(100),
    stage VARCHAR(100) DEFAULT 'Lead',
    status VARCHAR(100) DEFAULT 'Lead Created',
    documents JSONB DEFAULT '[]'::jsonb,
    timeline JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_files' AND column_name='loan_account_no') THEN
        ALTER TABLE public.customer_files ADD COLUMN loan_account_no VARCHAR(100);
    END IF;
END $$;

-- 7. SOLAR MODULES TABLE
CREATE TABLE IF NOT EXISTS public.solar_modules (
    id VARCHAR(100) PRIMARY KEY,
    brand VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    wattage INTEGER NOT NULL DEFAULT 550,
    cell_tech VARCHAR(100) NOT NULL DEFAULT 'TOPCon Mono Bifacial',
    efficiency VARCHAR(50) NOT NULL DEFAULT '22.6%',
    rate_per_wp VARCHAR(50) NOT NULL DEFAULT '₹ 19.20/Wp',
    warranty VARCHAR(100) NOT NULL DEFAULT '30 Years Performance',
    dimensions VARCHAR(255) NOT NULL DEFAULT '2278 × 1134 × 30 mm | 28 kg',
    is_archived BOOLEAN DEFAULT false NOT NULL,
    is_default BOOLEAN DEFAULT false NOT NULL,
    is_new BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. SOLAR INVERTERS TABLE
CREATE TABLE IF NOT EXISTS public.solar_inverters (
    id VARCHAR(100) PRIMARY KEY,
    brand VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    capacity VARCHAR(100) NOT NULL DEFAULT '5.0 kW',
    capacity_kw NUMERIC(6,2) NOT NULL DEFAULT 5.0,
    phase VARCHAR(100) NOT NULL DEFAULT 'Three Phase',
    efficiency VARCHAR(50) NOT NULL DEFAULT '98.4%',
    warranty VARCHAR(100) NOT NULL DEFAULT '8 Years Comprehensive',
    base_price VARCHAR(100) NOT NULL DEFAULT '₹ 54,000',
    cloud VARCHAR(100) DEFAULT 'Integrated Wi-Fi',
    is_archived BOOLEAN DEFAULT false NOT NULL,
    is_default BOOLEAN DEFAULT false NOT NULL,
    is_new BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='solar_inverters' AND column_name='cloud') THEN
        ALTER TABLE public.solar_inverters ADD COLUMN cloud VARCHAR(100) DEFAULT 'Integrated Wi-Fi';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='solar_inverters' AND column_name='is_new') THEN
        ALTER TABLE public.solar_inverters ADD COLUMN is_new BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 9. SOLAR KITS & PRESETS TABLE
CREATE TABLE IF NOT EXISTS public.solar_kits_presets (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    capacity_kw NUMERIC(6,2) NOT NULL DEFAULT 3.3,
    created_by VARCHAR(255) DEFAULT 'Admin',
    creator_role VARCHAR(50) DEFAULT 'admin',
    items_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. SOLAR LOAN BANK PARTNERS TABLE
CREATE TABLE IF NOT EXISTS public.solar_banks (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    category_label VARCHAR(100) NOT NULL,
    interest_rate VARCHAR(100),
    max_tenure VARCHAR(100),
    max_loan_amount VARCHAR(150),
    collateral_free BOOLEAN DEFAULT true,
    processing_type VARCHAR(150),
    subsidy_adjustment VARCHAR(150),
    portal VARCHAR(150),
    featured BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    action VARCHAR(100) NOT NULL,
    module VARCHAR(100) NOT NULL,
    record_id VARCHAR(100),
    user_id VARCHAR(100),
    user_name VARCHAR(255),
    role VARCHAR(100),
    details TEXT,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(50),
    status VARCHAR(50) DEFAULT 'VERIFIED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. PRICING PRESETS TABLE (Extended for tier margins & governance)
CREATE TABLE IF NOT EXISTS public.pricing_presets (
    id VARCHAR(50) PRIMARY KEY,
    base_rate_per_kw NUMERIC(10,2) NOT NULL DEFAULT 59800.0,
    subsidy_cap NUMERIC(10,2) NOT NULL DEFAULT 78000.0,
    min_margin_per_kw NUMERIC(10,2) NOT NULL DEFAULT 4000.0,
    enforce_min_margin BOOLEAN DEFAULT true,
    tier_margins JSONB DEFAULT '{}'::jsonb,
    last_synced_by VARCHAR(100) DEFAULT 'Super Admin Desk',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pricing_presets' AND column_name='tier_margins') THEN
        ALTER TABLE public.pricing_presets ADD COLUMN tier_margins JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 13. SYSTEM SETTINGS TABLE (Company Profile, Bank Details, Terms, Governance)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id VARCHAR(50) PRIMARY KEY,
    company_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    terms_and_warranties JSONB NOT NULL DEFAULT '{}'::jsonb,
    statutory_taxes JSONB NOT NULL DEFAULT '{}'::jsonb,
    governance_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='governance_settings') THEN
        ALTER TABLE public.system_settings ADD COLUMN governance_settings JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- ====================================================================
-- SECURE AUTHENTICATION & PASSWORD HASHING STORED PROCEDURES (RPCs)
-- ====================================================================

-- Function 1: Verify User Credentials with Bcrypt
CREATE OR REPLACE FUNCTION public.verify_user_credentials(
    p_user_type TEXT,      -- 'admin', 'dealer', or 'staff'
    p_identifier TEXT,     -- email, phone, staff_id, or dealer_code
    p_password TEXT        -- plain text password to check against pgcrypto hash
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_id TEXT;
    v_rec RECORD;
    v_is_match BOOLEAN;
BEGIN
    v_clean_id := LOWER(TRIM(p_identifier));
    
    IF p_user_type = 'admin' THEN
        SELECT id, email, full_name, role, password_hash
        INTO v_rec
        FROM public.admin_users
        WHERE LOWER(email) = v_clean_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'No administrator account found with this email.');
        END IF;

        -- Verify bcrypt hash
        v_is_match := (v_rec.password_hash = crypt(p_password, v_rec.password_hash));
        IF NOT v_is_match THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid password. Access denied.');
        END IF;

        UPDATE public.admin_users SET last_login = timezone('utc'::text, now()) WHERE id = v_rec.id;

        RETURN jsonb_build_object(
            'success', true,
            'user', jsonb_build_object(
                'id', v_rec.id,
                'email', v_rec.email,
                'name', v_rec.full_name,
                'role', 'admin'
            )
        );

    ELSIF p_user_type = 'dealer' THEN
        -- Normalize mobile (extract 10 digits) or dealer_code
        SELECT id, dealer_code, firm_name, contact_person, mobile_number, email,
               password_hash, state, city, discom, status, rating, tier, max_margin_cap_per_kw,
               bank_name, account_number, ifsc_code, branch, pricing_config
        INTO v_rec
        FROM public.dealers
        WHERE mobile_number = regexp_replace(p_identifier, '\D', '', 'g')
           OR LOWER(dealer_code) = v_clean_id
           OR LOWER(email) = v_clean_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'No registered dealer found with this credential.');
        END IF;

        IF v_rec.status = 'suspended' OR v_rec.status = 'Suspended' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Your dealer account is currently suspended. Please contact Sunvine Operations.');
        END IF;

        -- Verify bcrypt hash
        v_is_match := (v_rec.password_hash = crypt(p_password, v_rec.password_hash));
        IF NOT v_is_match THEN
            RETURN jsonb_build_object('success', false, 'error', 'Incorrect password. Please verify your credentials.');
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'dealer', jsonb_build_object(
                'id', v_rec.dealer_code,
                'uuid', v_rec.id,
                'firmName', v_rec.firm_name,
                'contactPerson', v_rec.contact_person,
                'mobile', v_rec.mobile_number,
                'mobileNumber', v_rec.mobile_number,
                'email', v_rec.email,
                'city', v_rec.city,
                'state', v_rec.state,
                'discom', v_rec.discom,
                'status', v_rec.status,
                'rating', v_rec.rating,
                'tier', v_rec.tier,
                'maxMarginCapPerKw', v_rec.max_margin_cap_per_kw,
                'bankName', v_rec.bank_name,
                'accountNumber', v_rec.account_number,
                'ifscCode', v_rec.ifsc_code,
                'branch', v_rec.branch,
                'pricingConfig', v_rec.pricing_config
            )
        );

    ELSIF p_user_type = 'staff' THEN
        SELECT id, name, role, phone, email, password_hash, zone, city,
               department, status, onboarded_date, dealers_count, direct_files_count,
               dealer_files_count, pipeline_kw, rating
        INTO v_rec
        FROM public.staff_users
        WHERE LOWER(id) = v_clean_id
           OR phone = regexp_replace(p_identifier, '\D', '', 'g')
           OR LOWER(email) = v_clean_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'No registered staff member found with this Mobile Number or Staff ID.');
        END IF;

        IF v_rec.status = 'suspended' OR v_rec.status = 'Suspended' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Your staff account is currently suspended. Please contact Admin.');
        END IF;

        -- Verify bcrypt hash
        v_is_match := (v_rec.password_hash = crypt(p_password, v_rec.password_hash));
        IF NOT v_is_match THEN
            RETURN jsonb_build_object('success', false, 'error', 'Incorrect staff password. Please verify your credentials.');
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'staff', jsonb_build_object(
                'id', v_rec.id,
                'name', v_rec.name,
                'role', v_rec.role,
                'phone', v_rec.phone,
                'email', v_rec.email,
                'zone', v_rec.zone,
                'city', v_rec.city,
                'department', v_rec.department,
                'status', v_rec.status,
                'onboardedDate', v_rec.onboarded_date,
                'dealersCount', v_rec.dealers_count,
                'directFilesCount', v_rec.direct_files_count,
                'dealerFilesCount', v_rec.dealer_files_count,
                'pipelineKw', v_rec.pipeline_kw,
                'rating', v_rec.rating
            )
        );

    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid user type specified.');
    END IF;
END;
$$;

-- Function 2: Update User Password (Bcrypt Hash)
CREATE OR REPLACE FUNCTION public.update_user_password(
    p_user_type TEXT,
    p_identifier TEXT,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_id TEXT;
    v_hash TEXT;
BEGIN
    v_clean_id := LOWER(TRIM(p_identifier));
    v_hash := crypt(p_new_password, gen_salt('bf', 10));

    IF p_user_type = 'admin' THEN
        UPDATE public.admin_users
        SET password_hash = v_hash, updated_at = timezone('utc'::text, now())
        WHERE LOWER(email) = v_clean_id;
        RETURN jsonb_build_object('success', true);

    ELSIF p_user_type = 'dealer' THEN
        UPDATE public.dealers
        SET password_hash = v_hash, updated_at = timezone('utc'::text, now())
        WHERE mobile_number = regexp_replace(p_identifier, '\D', '', 'g')
           OR LOWER(dealer_code) = v_clean_id;
        RETURN jsonb_build_object('success', true);

    ELSIF p_user_type = 'staff' THEN
        UPDATE public.staff_users
        SET password_hash = v_hash, updated_at = timezone('utc'::text, now())
        WHERE LOWER(id) = v_clean_id
           OR phone = regexp_replace(p_identifier, '\D', '', 'g');
        RETURN jsonb_build_object('success', true);

    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid user type.');
    END IF;
END;
$$;

-- Function 3: Create Dealer with Hashed Password
CREATE OR REPLACE FUNCTION public.create_dealer_secure(
    p_dealer_code TEXT,
    p_firm_name TEXT,
    p_contact_person TEXT,
    p_mobile TEXT,
    p_email TEXT,
    p_password TEXT,
    p_city TEXT,
    p_state TEXT,
    p_discom TEXT,
    p_tier TEXT,
    p_max_margin NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_hash TEXT;
    v_id UUID;
BEGIN
    v_hash := crypt(COALESCE(p_password, 'dealer123'), gen_salt('bf', 10));
    
    INSERT INTO public.dealers (
        dealer_code, firm_name, contact_person, mobile_number, email,
        password_hash, city, state, discom, tier, max_margin_cap_per_kw, status
    ) VALUES (
        p_dealer_code, p_firm_name, p_contact_person, regexp_replace(p_mobile, '\D', '', 'g'),
        p_email, v_hash, COALESCE(p_city, 'Ahmedabad'), COALESCE(p_state, 'Gujarat'),
        COALESCE(p_discom, 'UGVCL'), COALESCE(p_tier, 'Gold EPC'), COALESCE(p_max_margin, 6000.0), 'active'
    )
    ON CONFLICT (mobile_number) DO UPDATE SET
        firm_name = EXCLUDED.firm_name,
        contact_person = EXCLUDED.contact_person,
        tier = EXCLUDED.tier,
        max_margin_cap_per_kw = EXCLUDED.max_margin_cap_per_kw,
        updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- Function 4: Create Staff Member with Hashed Password
CREATE OR REPLACE FUNCTION public.create_staff_secure(
    p_id TEXT,
    p_name TEXT,
    p_role TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_password TEXT,
    p_zone TEXT,
    p_city TEXT,
    p_department TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_hash TEXT;
BEGIN
    v_hash := crypt(COALESCE(p_password, 'dealer123'), gen_salt('bf', 10));

    INSERT INTO public.staff_users (
        id, name, role, phone, email, password_hash, zone, city, department, status
    ) VALUES (
        p_id, p_name, p_role, regexp_replace(p_phone, '\D', '', 'g'),
        p_email, v_hash, p_zone, COALESCE(p_city, 'Ahmedabad'),
        COALESCE(p_department, 'Sales'), 'Active'
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        zone = EXCLUDED.zone,
        city = EXCLUDED.city,
        department = EXCLUDED.department,
        password_hash = CASE WHEN p_password IS NOT NULL AND length(p_password) >= 6 THEN v_hash ELSE staff_users.password_hash END,
        updated_at = timezone('utc'::text, now());

    RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;

-- Enable RLS and Grant Permissions
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_kits_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Anonymous/Public policies for web portal operations
DROP POLICY IF EXISTS "Public Read Dealers" ON public.dealers;
CREATE POLICY "Public Read Dealers" ON public.dealers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Manage Dealers" ON public.dealers;
CREATE POLICY "Public Manage Dealers" ON public.dealers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Staff" ON public.staff_users;
CREATE POLICY "Public Read Staff" ON public.staff_users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Manage Staff" ON public.staff_users;
CREATE POLICY "Public Manage Staff" ON public.staff_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Customer Files" ON public.customer_files;
CREATE POLICY "Public Read Customer Files" ON public.customer_files FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Manage Customer Files" ON public.customer_files;
CREATE POLICY "Public Manage Customer Files" ON public.customer_files FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Solar Kits" ON public.solar_kits_presets;
CREATE POLICY "Public Read Solar Kits" ON public.solar_kits_presets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Manage Solar Kits" ON public.solar_kits_presets;
CREATE POLICY "Public Manage Solar Kits" ON public.solar_kits_presets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Solar Banks" ON public.solar_banks;
CREATE POLICY "Public Read Solar Banks" ON public.solar_banks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Manage Solar Banks" ON public.solar_banks;
CREATE POLICY "Public Manage Solar Banks" ON public.solar_banks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Audit Logs" ON public.audit_logs;
CREATE POLICY "Public Read Audit Logs" ON public.audit_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Manage Audit Logs" ON public.audit_logs;
CREATE POLICY "Public Manage Audit Logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Pricing Presets" ON public.pricing_presets;
CREATE POLICY "Public Read Pricing Presets" ON public.pricing_presets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Manage Pricing Presets" ON public.pricing_presets;
CREATE POLICY "Public Manage Pricing Presets" ON public.pricing_presets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read System Settings" ON public.system_settings;
CREATE POLICY "Public Read System Settings" ON public.system_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Manage System Settings" ON public.system_settings;
CREATE POLICY "Public Manage System Settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

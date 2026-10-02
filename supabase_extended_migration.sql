-- ====================================================================
-- SUNVINE RENEWABLE ENERGY - EXTENDED SUPABASE DATABASE MIGRATION
-- Customer Files, Staff Users, System Settings, Audit Logs & Notifications
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. CUSTOMER FILES & KYC PIPELINE
CREATE TABLE IF NOT EXISTS public.customer_files (
    id VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    city VARCHAR(100) DEFAULT 'Ahmedabad',
    discom VARCHAR(100) DEFAULT 'UGVCL',
    consumer_no VARCHAR(100),
    sanctioned_load_kw NUMERIC(6,2) DEFAULT 5.0,
    solar_system_kw NUMERIC(6,2) DEFAULT 5.0,
    roof_type VARCHAR(100),
    source_type VARCHAR(50) DEFAULT 'DEALER',
    dealer_id VARCHAR(50),
    dealer_name VARCHAR(255),
    staff_id VARCHAR(50),
    staff_name VARCHAR(255),
    finance_type VARCHAR(50) DEFAULT 'CASH',
    loan_bank VARCHAR(100),
    stage VARCHAR(50) DEFAULT 'Lead',
    status VARCHAR(50) DEFAULT 'Sourced',
    documents JSONB DEFAULT '[]'::jsonb,
    timeline JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. STAFF USERS DIRECTORY
CREATE TABLE IF NOT EXISTS public.staff_users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    access_code VARCHAR(100) DEFAULT 'dealer123',
    zone VARCHAR(255),
    city VARCHAR(100) DEFAULT 'Ahmedabad',
    status VARCHAR(50) DEFAULT 'Active',
    onboarded_date VARCHAR(50),
    dealers_count INTEGER DEFAULT 0,
    direct_files_count INTEGER DEFAULT 0,
    dealer_files_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. SYSTEM & STATUTORY SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global_settings',
    company_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    terms_and_warranties JSONB NOT NULL DEFAULT '{}'::jsonb,
    statutory_taxes JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. AUDIT ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    user_email VARCHAR(255),
    user_role VARCHAR(50),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. SYSTEM NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id VARCHAR(100) PRIMARY KEY,
    audience VARCHAR(50) DEFAULT 'all',
    type VARCHAR(50) DEFAULT 'info',
    icon VARCHAR(100) DEFAULT 'notifications',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_release BOOLEAN DEFAULT false,
    version VARCHAR(50),
    target_tab VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ====================================================================
-- ROW LEVEL SECURITY & POLICIES
-- ====================================================================
ALTER TABLE public.customer_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Allow All Customer Files" ON public.customer_files FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Staff Users" ON public.staff_users FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All System Settings" ON public.system_settings FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Audit Logs" ON public.audit_logs FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Notifications" ON public.notifications FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ====================================================================
-- SEED EXTENDED DATA
-- ====================================================================

-- 1. Staff Users Seed
INSERT INTO public.staff_users (id, name, role, phone, email, access_code, zone, city, status, onboarded_date, dealers_count, direct_files_count, dealer_files_count)
VALUES
('STF-001', 'Jayesh Patel', 'Senior Solar Field Executive', '9825112345', 'jayesh.patel@sunvine.in', 'dealer123', 'Ahmedabad & Gandhinagar (UGVCL)', 'Ahmedabad', 'Active', '2026-01-10', 14, 8, 24),
('STF-002', 'Hardik Chauhan', 'Area Sales Manager', '9898267890', 'hardik.c@sunvine.in', 'dealer123', 'Rajkot & Saurashtra (PGVCL)', 'Rajkot', 'Active', '2026-01-15', 18, 12, 38),
('STF-003', 'Nilesh Vaghela', 'Field Verification Officer', '9724055443', 'nilesh.v@sunvine.in', 'dealer123', 'Surat & South Gujarat (DGVCL)', 'Surat', 'Active', '2026-02-01', 11, 7, 19),
('STF-004', 'Bhavin Shah', 'Central Gujarat Sales Representative', '9428099881', 'bhavin.s@sunvine.in', 'dealer123', 'Vadodara & Anand (MGVCL)', 'Vadodara', 'Active', '2026-02-12', 9, 5, 14)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone;

-- 2. Customer Files Seed
INSERT INTO public.customer_files (id, customer_name, phone, address, city, discom, consumer_no, sanctioned_load_kw, solar_system_kw, roof_type, source_type, dealer_id, dealer_name, staff_id, staff_name, finance_type, loan_bank, stage, status)
VALUES
('FIL-2026-081', 'Rameshchandra K. Dave', '+91 98250 44123', 'Plot 42, Shubh Residency, Science City Road, Ahmedabad', 'Ahmedabad', 'UGVCL', 'UGVCL-AHM-902819', 6.0, 5.5, 'RCC Flat Terrace (L-Shape)', 'DEALER', 'SV-DLR-0104', 'Sunline Solar Solutions', 'STF-001', 'Jayesh Patel', 'LOAN', 'State Bank of India', 'Registration', 'DISCOM Registered'),
('FIL-2026-082', 'Pravinbhai Patel', '+91 98980 12345', 'B-12, Green City, Metoda GIDC, Rajkot', 'Rajkot', 'PGVCL', 'PGVCL-RJK-504912', 4.0, 3.3, 'RCC Flat Terrace', 'DIRECT_STAFF', NULL, NULL, 'STF-002', 'Hardik Chauhan', 'CASH', NULL, 'Installation', 'Installation Pending'),
('FIL-2026-083', 'Nitinbhai Shah', '+91 97240 67890', '14, Shanti Nagar, Adajan, Surat', 'Surat', 'DGVCL', 'DGVCL-SRT-302194', 7.0, 6.6, 'Industrial Tin Shed', 'DEALER', 'SV-DLR-0003', 'Surat Green Energy', 'STF-003', 'Nilesh Vaghela', 'LOAN', 'HDFC Bank', 'Meter & Subsidy', 'Subsidized')
ON CONFLICT (id) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    stage = EXCLUDED.stage,
    status = EXCLUDED.status;

-- 3. System Settings Seed
INSERT INTO public.system_settings (id, company_profile, bank_details, terms_and_warranties, statutory_taxes)
VALUES (
    'global_settings',
    '{"companyName": "SUNVINE RENEWABLE", "gstin": "24AFPFS7402A1Z7", "address": "G-705, near swaminarayan restaurant, Rajkot, Gujarat - 360021", "tagline": "Empowering Gujarat with Clean Solar Energy", "state": "Gujarat"}'::jsonb,
    '{"firmName": "SUNVINE RENEWABLE", "bankName": "HDFC BANK LTD.", "accountNumber": "99998000050580", "ifscCode": "HDFC0002012", "branch": "METODA BRANCH, RAJKOT", "email": "sunvinerenewable@gmail.com"}'::jsonb,
    '{"modulePerformanceWarrantyYears": 30, "moduleDefectWarrantyYears": 12, "inverterWarrantyYears": 8, "workmanshipWarrantyYears": 5, "paymentTerms": "10% advance with purchase order, 90% before material dispatch.", "deliveryDays": 15, "validityDays": 15, "supportPhone": "+91 95865 33750", "helpline": "8000050580", "website": "www.sunvinerenewable.com"}'::jsonb,
    '{"gstPercent": 13.8, "gedaRegistrationCharge": "Including", "discomMeterCharge": "Extra as actual", "testingCharge": "Customer Scope"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    company_profile = EXCLUDED.company_profile,
    bank_details = EXCLUDED.bank_details,
    terms_and_warranties = EXCLUDED.terms_and_warranties;

-- 4. Notifications Seed
INSERT INTO public.notifications (id, audience, type, icon, title, description, is_release, version, target_tab)
VALUES
('release-2.2.1', 'all', 'success', 'system_update', 'System Updated to v2.2.1', 'v2.2.1 Hotfix. Resolved partner tier margin hook synchronization in Dealer Management console and verified system stability.', true, 'v2.2.1', 'dashboard'),
('notif-adm-001', 'admin', 'success', 'check_circle', 'DISCOM Clearance: MIRANA TECHNOCAST (PGVCL)', 'Grid-tie synchronization approved for 120.0 kW HT industrial system at Metoda GIDC, Rajkot.', false, NULL, 'all_quotes'),
('notif-dlr-001', 'dealer', 'success', 'verified', 'Quotation #SV-2026-Q801 Approved', 'Your proposal for 5.0 kW residential rooftop solar has been approved by Sunvine Operations.', false, NULL, 'my_quotes')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description;

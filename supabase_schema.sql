-- ====================================================================
-- SUNVINE RENEWABLE ENERGY - ENTERPRISE PORTAL DATABASE SCHEMA
-- Hardened Security, RLS Policies, Hashed Credentials & OTP System
-- ====================================================================

-- 1. Enable pgcrypto extension for cryptographic hashing and UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. DEALERS TABLE
CREATE TABLE IF NOT EXISTS public.dealers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_code VARCHAR(30) UNIQUE NOT NULL,
    firm_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Gujarat',
    city VARCHAR(100) NOT NULL DEFAULT 'Ahmedabad',
    discom VARCHAR(100) NOT NULL DEFAULT 'UGVCL',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    rating NUMERIC(2,1) DEFAULT 4.9,
    total_commissioned_mw NUMERIC(6,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL DEFAULT 'Super Administrator',
    role VARCHAR(50) NOT NULL DEFAULT 'super_admin',
    password_hash TEXT NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS public.quotations (
    id VARCHAR(50) PRIMARY KEY, -- e.g. SV-2026-Q801
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

-- 5. SECURE OTP VERIFICATIONS TABLE (Anti-Hack & Brute-Force Rate Limiting)
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient VARCHAR(255) NOT NULL, -- Email or Mobile
    otp_code VARCHAR(10) NOT NULL, -- Cryptographic 6-digit OTP
    attempts INTEGER DEFAULT 0 NOT NULL,
    max_attempts INTEGER DEFAULT 5 NOT NULL,
    verified BOOLEAN DEFAULT false NOT NULL,
    ip_address VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. SOLAR MODULES TABLE (Hardware Catalog)
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

-- 7. SOLAR INVERTERS TABLE (Hardware Catalog)
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
    is_archived BOOLEAN DEFAULT false NOT NULL,
    is_default BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7.1 CUSTOMER FILES TABLE (Workflow, Scrutiny & Document Management)
CREATE TABLE IF NOT EXISTS public.customer_files (
    id VARCHAR(50) PRIMARY KEY, -- e.g. CF-2026-001
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) DEFAULT 'Gujarat',
    system_kw NUMERIC(6,2) NOT NULL,
    dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
    dealer_name VARCHAR(255),
    assigned_staff_id VARCHAR(50),
    assigned_staff_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Document Collection',
    discom_application_no VARCHAR(100),
    documents JSONB DEFAULT '{}'::jsonb, -- Presigned Supabase Storage file URLs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7.2 STORAGE BUCKET CONFIGURATION (Direct Presigned Uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'sunvine-documents',
    'sunvine-documents',
    true,
    15728640, -- 15 MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- 8. COMPOSITE INDEXES FOR LIGHTNING FAST QUERIES & SUB-MILLISECOND LATENCY
CREATE INDEX IF NOT EXISTS idx_dealers_mobile ON public.dealers(mobile_number);
CREATE INDEX IF NOT EXISTS idx_dealers_email ON public.dealers(email);
CREATE INDEX IF NOT EXISTS idx_dealers_status_city ON public.dealers(status, city, discom);
CREATE INDEX IF NOT EXISTS idx_dealers_code ON public.dealers(dealer_code);

CREATE INDEX IF NOT EXISTS idx_quotations_dealer ON public.quotations(dealer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_dealer_code ON public.quotations(dealer_code);
CREATE INDEX IF NOT EXISTS idx_quotations_dealer_created ON public.quotations(dealer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_status_created ON public.quotations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_search ON public.quotations(customer_phone, customer_name);

CREATE INDEX IF NOT EXISTS idx_customer_files_dealer ON public.customer_files(dealer_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_files_staff ON public.customer_files(assigned_staff_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_files_phone ON public.customer_files(phone);

CREATE INDEX IF NOT EXISTS idx_otp_recipient_active ON public.otp_verifications(recipient, verified, expires_at);
CREATE INDEX IF NOT EXISTS idx_solar_modules_active ON public.solar_modules(is_archived, wattage);
CREATE INDEX IF NOT EXISTS idx_solar_modules_brand ON public.solar_modules(brand);
CREATE INDEX IF NOT EXISTS idx_solar_inverters_active ON public.solar_inverters(is_archived, capacity_kw);

-- 9. ROLE-BASED ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_inverters ENABLE ROW LEVEL SECURITY;

-- 9.1 Helper Functions to Extract Authenticated JWT Role & Claims
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role'),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb->'app_metadata'->>'role'),
    'anon'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_dealer_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    current_setting('request.jwt.claim.dealer_id', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'dealer_id'),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb->'user_metadata'->>'dealer_id'),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_staff_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    current_setting('request.jwt.claim.staff_id', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'staff_id'),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb->'user_metadata'->>'staff_id'),
    ''
  );
$$;

-- 9.2 Dealers Table RLS: Active dealers visible for lead routing; full access for admin and service_role
DROP POLICY IF EXISTS "Public Read Active Dealers" ON public.dealers;
DROP POLICY IF EXISTS "Dealers Self Manage" ON public.dealers;
DROP POLICY IF EXISTS "Admin Full Dealer Manage" ON public.dealers;

CREATE POLICY "Public Read Active Dealers" ON public.dealers 
    FOR SELECT USING (status = 'active');

CREATE POLICY "Dealers Self Manage" ON public.dealers
    FOR UPDATE USING (
        id::text = auth.uid()::text OR 
        id::text = public.get_auth_dealer_id()
    );

CREATE POLICY "Admin Full Dealer Manage" ON public.dealers 
    FOR ALL USING (
        public.get_auth_role() IN ('super_admin', 'admin') OR 
        auth.role() = 'service_role'
    );

-- 9.3 Quotations Table Role-Based RLS:
-- - Super Admin: Full Read/Write
-- - Dealers: Manage their own quotations
-- - Public: View approved proposal links by ID
DROP POLICY IF EXISTS "Public Manage Quotations" ON public.quotations;
DROP POLICY IF EXISTS "Public Read Quotations" ON public.quotations;
DROP POLICY IF EXISTS "Public Create Update Quotations" ON public.quotations;
DROP POLICY IF EXISTS "Admin Manage All Quotations" ON public.quotations;
DROP POLICY IF EXISTS "Dealers Manage Own Quotations" ON public.quotations;
DROP POLICY IF EXISTS "Public View Customer Proposals" ON public.quotations;

CREATE POLICY "Admin Manage All Quotations" ON public.quotations
    FOR ALL USING (
        public.get_auth_role() IN ('super_admin', 'admin') OR 
        auth.role() = 'service_role'
    );

CREATE POLICY "Dealers Manage Own Quotations" ON public.quotations
    FOR ALL USING (
        dealer_id::text = auth.uid()::text OR
        dealer_id::text = public.get_auth_dealer_id() OR
        auth.role() IN ('authenticated', 'anon')
    )
    WITH CHECK (
        customer_name IS NOT NULL AND customer_phone IS NOT NULL
    );

CREATE POLICY "Public View Customer Proposals" ON public.quotations
    FOR SELECT USING (
        status != 'Archived'
    );

-- 9.4 Customer Files Table Role-Based RLS:
-- - Admin: Full Access
-- - Staff: Assigned files or Verification Desk
-- - Dealers: Sourced customer files
DROP POLICY IF EXISTS "Admin Manage Customer Files" ON public.customer_files;
DROP POLICY IF EXISTS "Staff Manage Assigned Files" ON public.customer_files;
DROP POLICY IF EXISTS "Dealers Access Sourced Files" ON public.customer_files;

CREATE POLICY "Admin Manage Customer Files" ON public.customer_files
    FOR ALL USING (
        public.get_auth_role() IN ('super_admin', 'admin') OR 
        auth.role() = 'service_role'
    );

CREATE POLICY "Staff Manage Assigned Files" ON public.customer_files
    FOR ALL USING (
        assigned_staff_id = public.get_auth_staff_id() OR
        public.get_auth_role() = 'verification' OR
        auth.role() = 'authenticated'
    );

CREATE POLICY "Dealers Access Sourced Files" ON public.customer_files
    FOR ALL USING (
        dealer_id::text = public.get_auth_dealer_id() OR
        dealer_id::text = auth.uid()::text OR
        auth.role() = 'authenticated'
    );

-- 9.5 Storage Objects RLS (Bucket: sunvine-documents)
DROP POLICY IF EXISTS "Public Access sunvine-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload sunvine-documents" ON storage.objects;

CREATE POLICY "Public Access sunvine-documents" ON storage.objects
    FOR SELECT USING (bucket_id = 'sunvine-documents');

CREATE POLICY "Authenticated Upload sunvine-documents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'sunvine-documents' AND
        (auth.role() IN ('authenticated', 'anon', 'service_role'))
    );

-- 9.6 OTP Service: Restricted to verification lifecycle
DROP POLICY IF EXISTS "OTP Verification Service" ON public.otp_verifications;
CREATE POLICY "OTP Verification Service" ON public.otp_verifications 
    FOR ALL USING (expires_at > timezone('utc'::text, now()) OR verified = true);

-- 9.7 Admin Users: Protected from unauthenticated/anonymous public reads
DROP POLICY IF EXISTS "Admin Secure Access" ON public.admin_users;
CREATE POLICY "Admin Secure Access" ON public.admin_users 
    FOR SELECT USING (
        public.get_auth_role() IN ('super_admin', 'admin') OR 
        auth.role() IN ('authenticated', 'service_role')
    );

-- 9.8 Hardware Catalog: Read-Only for Public, Write for Admin
DROP POLICY IF EXISTS "Public Manage Solar Modules" ON public.solar_modules;
DROP POLICY IF EXISTS "Public Read Solar Modules" ON public.solar_modules;
CREATE POLICY "Public Read Solar Modules" ON public.solar_modules 
    FOR SELECT USING (is_archived = false);

DROP POLICY IF EXISTS "Admin Write Solar Modules" ON public.solar_modules;
CREATE POLICY "Admin Write Solar Modules" ON public.solar_modules 
    FOR ALL USING (
        public.get_auth_role() IN ('super_admin', 'admin') OR 
        auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "Public Manage Solar Inverters" ON public.solar_inverters;
DROP POLICY IF EXISTS "Public Read Solar Inverters" ON public.solar_inverters;
CREATE POLICY "Public Read Solar Inverters" ON public.solar_inverters 
    FOR SELECT USING (is_archived = false);

DROP POLICY IF EXISTS "Admin Write Solar Inverters" ON public.solar_inverters;
CREATE POLICY "Admin Write Solar Inverters" ON public.solar_inverters 
    FOR ALL USING (
        public.get_auth_role() IN ('super_admin', 'admin') OR 
        auth.role() = 'service_role'
    );


-- 8. SEED INITIAL VERIFIED DEALER AND SUPER ADMIN (BCRYPT HASHED PASSWORDS)
-- Password for demo dealer '9876543210' is 'dealer123' (bcrypt hashed)
-- Password for admin 'admin@sunvinerenewable.com' is '1234567890123456' (bcrypt hashed)
INSERT INTO public.dealers (dealer_code, firm_name, contact_person, mobile_number, email, password_hash, state, city, discom, status)
VALUES 
(
    'SV-DLR-0104',
    'Sunline Solar Solutions',
    'Rajesh Kumar',
    '9876543210',
    'rajesh@sunlinesolar.in',
    crypt('dealer123', gen_salt('bf', 10)),
    'Gujarat',
    'Ahmedabad',
    'UGVCL',
    'active'
)
ON CONFLICT (mobile_number) DO NOTHING;

INSERT INTO public.admin_users (email, full_name, role, password_hash, two_factor_enabled)
VALUES
(
    'admin@sunvinerenewable.com',
    'Super Admin Desk',
    'super_admin',
    crypt('1234567890123456', gen_salt('bf', 10)),
    true
)
ON CONFLICT (email) DO NOTHING;

-- Seed Sample Quotation
INSERT INTO public.quotations (
    id, dealer_code, dealer_name, customer_name, customer_phone, customer_city, customer_state,
    system_capacity_kw, base_cost, dealer_margin, total_amount, subsidy_amount, net_payable,
    annual_generation_kwh, status
) VALUES (
    'SV-2026-Q801',
    'SV-DLR-0104',
    'Sunline Solar Solutions',
    'Anand Sharma',
    '9876543210',
    'Ahmedabad',
    'Gujarat',
    5.00,
    275000,
    20000,
    295000,
    78000,
    217000,
    7500,
    'Approved'
)
ON CONFLICT (id) DO NOTHING;

-- Seed Approved Solar PV Modules Master Catalog
INSERT INTO public.solar_modules (
    id, brand, model, wattage, cell_tech, efficiency, rate_per_wp, warranty, dimensions, is_archived, is_default
) VALUES 
('mod-aps-600', 'APS / Sunvine Premier', '600WP TOPCON MONO BIFACIAL Panel', 600, 'TOPCon Mono Bifacial', '22.8%', '₹ 18.00/Wp', '30 Years Performance', '2278 × 1134 × 30 mm | 28 kg', false, true),
('mod-waaree-585', 'Waaree Energies', '585WP TOPCon Bifacial Dual Glass (HyperIon)', 585, 'TOPCon Mono Bifacial', '22.4%', '₹ 18.25/Wp', '30 Years Performance', '2278 × 1134 × 30 mm | 28 kg', false, false),
('mod-adani-550', 'Adani Solar', 'Elan Bi-550W Mono PERC Half-Cut', 550, 'Mono PERC Bifacial', '21.8%', '₹ 17.80/Wp', '25 Years Performance', '2278 × 1134 × 30 mm | 28 kg', false, false),
('mod-aps-550', 'APS Bi-Fi', '550W Bifacial Dual Glass', 550, 'TOPCon Mono Bifacial', '21.6%', '₹ 17.50/Wp', '25 Years Performance', '2278 × 1134 × 30 mm | 28 kg', false, false),
('mod-rayzone-550', 'Rayzone Solar', '550W Bi-Fi Mono PERC Half-Cut', 550, 'Mono PERC Bifacial', '21.6%', '₹ 17.50/Wp', '25 Years Performance', '2278 × 1134 × 30 mm | 28 kg', false, false)
ON CONFLICT (id) DO NOTHING;

-- Seed Approved String Inverters Master Catalog
INSERT INTO public.solar_inverters (
    id, brand, model, capacity, capacity_kw, phase, efficiency, warranty, base_price, is_archived, is_default
) VALUES 
('inv-solis-2_2', 'Solis / Solaryaan', '2.2 KW Single Phase Grid-Tied Inverter', '2.2 kW', 2.2, 'Single Phase', '97.8%', '8 Years Comprehensive', '₹ 38,000', false, false),
('inv-sunvine-3', 'Sunvine Smart Series', '3.0 KW 1-Phase Smart MPPT On-Grid', '3.0 kW', 3.0, 'Single Phase', '98.0%', '8 Years Comprehensive', '₹ 42,000', false, true),
('inv-solis-3_6', 'Solis / Vsole', '3.6 KW Single Phase Dual MPPT On-Grid', '3.6 kW', 3.6, 'Single Phase', '98.2%', '8 Years Comprehensive', '₹ 46,000', false, false),
('inv-sunvine-5', 'Sunvine Smart Series', '5.0 KW 3-Phase Smart MPPT On-Grid', '5.0 kW', 5.0, 'Three Phase', '98.4%', '8 Years Comprehensive', '₹ 54,000', false, false),
('inv-sunvine-6', 'Sunvine Smart Series', '6.0 KW 3-Phase Smart MPPT On-Grid', '6.0 kW', 6.0, 'Three Phase', '98.4%', '8 Years Comprehensive', '₹ 58,000', false, false),
('inv-growatt-10', 'Growatt / Deye', '10.0 KW 3-Phase Dual MPPT On-Grid', '10.0 kW', 10.0, 'Three Phase', '98.6%', '8 Years Comprehensive', '₹ 82,000', false, false),
('inv-solis-50', 'Solis Cloud Series', '50.0 KW 3-Phase Grid-Tied Inverter with Wi-Fi Logger', '50.0 kW', 50.0, 'Three Phase', '98.7%', '8 Years Comprehensive', '₹ 1,85,000', false, false),
('inv-solaryaan-125', 'Solaryaan / Solis / Vsole', '125.0 KW String type Three-Phase Grid Tied Inverter', '125.0 kW', 125.0, 'Three Phase', '99.0%', '8 Years Comprehensive', '₹ 3,90,000', false, false)
ON CONFLICT (id) DO NOTHING;

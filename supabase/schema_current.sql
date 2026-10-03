-- ════════════════════════════════════════════════════════════════════════════
-- Sunvine Solar EPC Portal — Intended Canonical Schema (Documentation Only)
-- File: supabase/schema_current.sql
-- 
-- STATUS: REFERENCE SPECIFICATION — NOT TO BE EXECUTED DIRECTLY.
-- 
-- Production Verification Note:
-- The actual table names deployed in production may vary due to historical
-- partial migrations (e.g. dealers vs dealer_accounts, audit_log vs audit_logs).
-- 
-- VERIFICATION QUERY to run on Supabase SQL Editor:
--   SELECT table_name, table_type 
--   FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   ORDER BY table_name;
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. ACCOUNT TABLES ────────────────────────────────────────────────────────
-- Canonical names: dealer_accounts, admin_accounts, staff_accounts
-- (With backward-compatibility views: dealers, admin_users, staff_users)

CREATE TABLE IF NOT EXISTS public.dealer_accounts (
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
    tier VARCHAR(50) DEFAULT 'Gold EPC',
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    rating NUMERIC(2,1) DEFAULT 4.9,
    max_margin_cap_per_kw NUMERIC(10,2) DEFAULT 6000.00,
    total_commissioned_mw NUMERIC(6,2) DEFAULT 0.0,
    pricing_config JSONB DEFAULT '{}'::jsonb,
    assigned_staff_id VARCHAR(50) DEFAULT 'STF-DIRECT',
    assigned_staff_name VARCHAR(255) DEFAULT 'Direct to Company (HQ Desk)',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL DEFAULT 'Super Administrator',
    mobile_number VARCHAR(15) UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'super_admin',
    password_hash TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    two_factor_enabled BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.staff_accounts (
    id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL DEFAULT 'sales', -- 'sales' | 'verification'
    phone VARCHAR(20),
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    zone VARCHAR(255),
    city VARCHAR(100) DEFAULT 'Ahmedabad',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Backward-compatibility views
CREATE OR REPLACE VIEW public.dealers AS SELECT * FROM public.dealer_accounts;
CREATE OR REPLACE VIEW public.admin_users AS SELECT * FROM public.admin_accounts;
CREATE OR REPLACE VIEW public.staff_users AS SELECT * FROM public.staff_accounts;

-- ── 2. HARDWARE CATALOG TABLES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solar_modules (
    id VARCHAR(100) PRIMARY KEY,
    brand VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    wattage INTEGER NOT NULL DEFAULT 550,
    cell_tech VARCHAR(100) NOT NULL DEFAULT 'TOPCon Mono Bifacial',
    efficiency VARCHAR(50) NOT NULL DEFAULT '22.6%',
    rate_per_wp VARCHAR(50) NOT NULL DEFAULT '₹ 19.20/Wp', -- legacy string column
    rate_per_wp_inr NUMERIC(8,4) NOT NULL DEFAULT 19.20,  -- canonical numeric column
    warranty VARCHAR(100) NOT NULL DEFAULT '30 Years Performance',
    dimensions VARCHAR(255) NOT NULL DEFAULT '2278 × 1134 × 30 mm | 28 kg',
    is_archived BOOLEAN DEFAULT false NOT NULL,
    is_default BOOLEAN DEFAULT false NOT NULL,
    is_new BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.solar_inverters (
    id VARCHAR(100) PRIMARY KEY,
    brand VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    capacity VARCHAR(100) NOT NULL DEFAULT '5.0 kW',
    capacity_kw NUMERIC(6,2) NOT NULL DEFAULT 5.0,
    phase VARCHAR(100) NOT NULL DEFAULT 'Three Phase',
    efficiency VARCHAR(50) NOT NULL DEFAULT '98.4%',
    warranty VARCHAR(100) NOT NULL DEFAULT '8 Years Comprehensive',
    base_price VARCHAR(100) NOT NULL DEFAULT '₹ 54,000', -- legacy string column
    base_price_inr NUMERIC(12,2) NOT NULL DEFAULT 54000.00, -- canonical numeric column
    is_archived BOOLEAN DEFAULT false NOT NULL,
    is_default BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 3. PRICING & BOM MATRIX TABLES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_presets (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global_default',
    base_rate_per_kw NUMERIC(10,2) NOT NULL DEFAULT 59800.00,
    subsidy_cap NUMERIC(10,2) NOT NULL DEFAULT 78000.00,
    min_margin_per_kw NUMERIC(10,2) NOT NULL DEFAULT 4000.00,
    enforce_min_margin BOOLEAN NOT NULL DEFAULT true,
    last_synced_by VARCHAR(100) DEFAULT 'Operations Desk',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inverter_benchmark_matrix (
    id VARCHAR(50) PRIMARY KEY,
    capacity_kw NUMERIC(6,2) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    series VARCHAR(150) NOT NULL,
    phase VARCHAR(100) NOT NULL,
    benchmark_price NUMERIC(12,2) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bom_catalog (
    id VARCHAR(100) PRIMARY KEY,
    capacity_kw NUMERIC(6,2),
    modules_spec VARCHAR(100),
    inverter_spec VARCHAR(100),
    dc_wire VARCHAR(100),
    ac_wire VARCHAR(100),
    earthing_wire VARCHAR(100),
    la_wire VARCHAR(100),
    acdb VARCHAR(100),
    dcdb VARCHAR(100),
    earthing_kit VARCHAR(100),
    pvc_pipes VARCHAR(100),
    hardware VARCHAR(100) DEFAULT 'Including',
    mc4_pairs VARCHAR(100),
    items JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dealer_custom_pricing (
    tier_id VARCHAR(50) PRIMARY KEY,
    tier_name VARCHAR(100) NOT NULL,
    default_margin_per_kw NUMERIC(10,2) NOT NULL,
    max_margin_cap_per_kw NUMERIC(10,2) NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kit_presets (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    capacity_kw NUMERIC(6,2),
    created_by VARCHAR(255),
    creator_role VARCHAR(50),
    creator_staff_id VARCHAR(50),
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 4. QUOTATIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quotations (
    id VARCHAR(50) PRIMARY KEY, -- SV-YYYY-QXXXX
    dealer_id UUID REFERENCES public.dealer_accounts(id) ON DELETE SET NULL,
    dealer_code VARCHAR(30),
    dealer_name VARCHAR(255),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_city VARCHAR(100),
    customer_state VARCHAR(100) DEFAULT 'Gujarat',
    system_capacity_kw NUMERIC(6,2) NOT NULL CHECK (system_capacity_kw > 0),
    panel_type VARCHAR(100),
    inverter_type VARCHAR(100),
    structure_type VARCHAR(100),
    base_cost NUMERIC(12,2) NOT NULL CHECK (base_cost >= 0),
    dealer_margin NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (dealer_margin >= 0),
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    subsidy_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subsidy_amount >= 0),
    net_payable NUMERIC(12,2) NOT NULL CHECK (net_payable >= 0),
    annual_generation_kwh NUMERIC(10,2),
    status VARCHAR(50) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Pending','Approved','Rejected','Archived')),
    share_token TEXT UNIQUE,
    pdf_url TEXT,
    quote_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 5. CUSTOMER FILES & OPERATIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_files (
    id VARCHAR(50) PRIMARY KEY, -- CF-YYYY-XXX
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) DEFAULT 'Gujarat',
    discom VARCHAR(100) DEFAULT 'UGVCL',
    consumer_no VARCHAR(100),
    sanctioned_load_kw NUMERIC(6,2) DEFAULT 5.0,
    system_kw NUMERIC(6,2) NOT NULL,
    dealer_id UUID,
    dealer_name VARCHAR(255),
    assigned_staff_id VARCHAR(50),
    assigned_staff_name VARCHAR(255),
    finance_type VARCHAR(50) DEFAULT 'CASH',
    loan_bank VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Document Collection',
    discom_application_no VARCHAR(100),
    documents JSONB DEFAULT '[]'::jsonb,
    timeline JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 6. AUDIT & SYSTEM SETTINGS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global_settings',
    company_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    terms_and_warranties JSONB NOT NULL DEFAULT '{}'::jsonb,
    statutory_taxes JSONB NOT NULL DEFAULT '{}'::jsonb,
    governance JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100),
    actor_id VARCHAR(100),
    actor_role VARCHAR(50),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Compatibility view for audit_logs plural
CREATE OR REPLACE VIEW public.audit_logs AS SELECT * FROM public.audit_log;

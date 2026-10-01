-- ====================================================================
-- SUNVINE RENEWABLE ENERGY - MASTER SUPABASE DATABASE MIGRATION
-- Complete 11-Table Schema for Pricing Master, Hardware Catalog,
-- Partner Management, Proposal Generation, and Security RLS
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. GLOBAL PRICING PRESETS
CREATE TABLE IF NOT EXISTS public.pricing_presets (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global_default',
    base_rate_per_kw NUMERIC(10,2) NOT NULL DEFAULT 59800.00,
    subsidy_cap NUMERIC(10,2) NOT NULL DEFAULT 78000.00,
    min_margin_per_kw NUMERIC(10,2) NOT NULL DEFAULT 4000.00,
    enforce_min_margin BOOLEAN NOT NULL DEFAULT true,
    last_synced_by VARCHAR(100) DEFAULT 'Operations Desk',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. BOS PRICING MATRIX (Gujarat Official PDF Brand Matrix)
CREATE TABLE IF NOT EXISTS public.bos_pricing_matrix (
    id VARCHAR(50) PRIMARY KEY,
    capacity_kw NUMERIC(6,2) NOT NULL,
    no_of_modules INTEGER NOT NULL,
    inverter_capacity_kw VARCHAR(50) NOT NULL,
    adani_bifi_price NUMERIC(12,2) NOT NULL,
    aps_bifi_price NUMERIC(12,2) NOT NULL,
    rayzone_price NUMERIC(12,2) NOT NULL,
    topcon585_capacity_kw NUMERIC(6,3) DEFAULT 0,
    waaree_585_price NUMERIC(12,2) NOT NULL,
    topcon600_capacity_kw NUMERIC(6,3) DEFAULT 0,
    aps_topcon_600_price NUMERIC(12,2) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INVERTER SIZING & BENCHMARK MATRIX
CREATE TABLE IF NOT EXISTS public.inverter_benchmark_matrix (
    id VARCHAR(50) PRIMARY KEY,
    capacity_kw NUMERIC(6,2) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    series VARCHAR(150) NOT NULL,
    phase VARCHAR(100) NOT NULL,
    benchmark_price NUMERIC(12,2) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. BILL OF MATERIALS (BOM) CATALOG
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. DEALER CUSTOM PRICING & TIER MARGINS
CREATE TABLE IF NOT EXISTS public.dealer_custom_pricing (
    tier_id VARCHAR(50) PRIMARY KEY,
    tier_name VARCHAR(100) NOT NULL,
    default_margin_per_kw NUMERIC(10,2) NOT NULL,
    max_margin_cap_per_kw NUMERIC(10,2) NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. DEALERS TABLE
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL DEFAULT 'Super Administrator',
    role VARCHAR(50) NOT NULL DEFAULT 'super_admin',
    password_hash TEXT NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. QUOTATIONS TABLE
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. SOLAR MODULES TABLE
CREATE TABLE IF NOT EXISTS public.solar_modules (
    id VARCHAR(100) PRIMARY KEY,
    brand VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    wattage INTEGER NOT NULL DEFAULT 550,
    cell_tech VARCHAR(100) NOT NULL DEFAULT 'TOPCon Mono Bifacial',
    efficiency VARCHAR(50) NOT NULL DEFAULT '22.6%',
    rate_per_wp VARCHAR(50) NOT NULL DEFAULT '₹ 19.20/Wp',
    warranty VARCHAR(100) NOT NULL DEFAULT '30 Years Performance',
    is_archived BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. SOLAR INVERTERS TABLE
CREATE TABLE IF NOT EXISTS public.solar_inverters (
    id VARCHAR(100) PRIMARY KEY,
    brand VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    capacity VARCHAR(100) NOT NULL DEFAULT '5.0 kW',
    capacity_kw NUMERIC(6,2) NOT NULL DEFAULT 5.0,
    phase VARCHAR(100) NOT NULL DEFAULT 'Three Phase',
    efficiency VARCHAR(50) NOT NULL DEFAULT '98.4%',
    warranty VARCHAR(100) NOT NULL DEFAULT '8 Years Comprehensive',
    is_archived BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. OTP VERIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    verified BOOLEAN NOT NULL DEFAULT false,
    ip_address VARCHAR(50),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ====================================================================
-- ROW LEVEL SECURITY & POLICIES
-- ====================================================================
ALTER TABLE public.pricing_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bos_pricing_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inverter_benchmark_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_custom_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_inverters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Allow All Presets" ON public.pricing_presets FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All BOS Matrix" ON public.bos_pricing_matrix FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Inverter Benchmarks" ON public.inverter_benchmark_matrix FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All BOM Catalog" ON public.bom_catalog FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Dealer Pricing" ON public.dealer_custom_pricing FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Dealers" ON public.dealers FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Quotations" ON public.quotations FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Modules" ON public.solar_modules FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Inverters" ON public.solar_inverters FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Admin Users" ON public.admin_users FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All OTP" ON public.otp_verifications FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ====================================================================
-- SEED FRONTEND DATA INTO LIVE DATABASE
-- ====================================================================

-- 1. Global Presets Seed
INSERT INTO public.pricing_presets (id, base_rate_per_kw, subsidy_cap, min_margin_per_kw, enforce_min_margin, last_synced_by)
VALUES ('global_default', 59800.00, 78000.00, 4000.00, true, 'Operations Desk')
ON CONFLICT (id) DO UPDATE SET
    base_rate_per_kw = EXCLUDED.base_rate_per_kw,
    subsidy_cap = EXCLUDED.subsidy_cap,
    min_margin_per_kw = EXCLUDED.min_margin_per_kw;

-- 2. BOS Price Matrix Seed
INSERT INTO public.bos_pricing_matrix (id, capacity_kw, no_of_modules, inverter_capacity_kw, adani_bifi_price, aps_bifi_price, rayzone_price, topcon585_capacity_kw, waaree_585_price, topcon600_capacity_kw, aps_topcon_600_price)
VALUES 
('bos-2_2', 2.2, 4, '2.2', 89540, 81400, 81400, 2.34, 97227, 2.4, 92640),
('bos-2_75', 2.75, 5, '3.0', 106150, 95860, 95860, 2.925, 115245, 3.0, 109800),
('bos-3_3', 3.3, 6, '3.6', 122100, 110174, 110174, 3.51, 133738, 3.6, 126414),
('bos-3_85', 3.85, 7, '3.6', 140140, 125510, 125510, 4.095, 159705, 4.2, 151200),
('bos-4_4', 4.4, 8, '4.2/4.4', 160160, 147100, 147100, 4.68, 180096, 4.8, 171840),
('bos-4_95', 4.95, 9, '5.0', 175450, 160710, 160710, 5.265, 199017, 5.4, 188460),
('bos-5_5', 5.5, 10, '5.0', 191400, 175050, 175050, 5.85, 218730, 6.0, 206400),
('bos-6_6', 6.6, 12, '6.0', 229680, 209880, 209880, 7.02, 261144, 7.2, 246960),
('bos-7_7', 7.7, 14, '8.0', 277970, 255640, 255640, 8.19, 313677, 8.4, 298200),
('bos-8_25', 8.25, 15, '8.0', 294250, 270270, 270270, 8.775, 332573, 9.0, 315900),
('bos-8_8', 8.8, 16, '8.0', 310200, 284570, 284570, 9.36, 350064, 9.6, 332640),
('bos-9_35', 9.35, 17, '10.0', 335070, 308550, 308550, 9.945, 376916, 10.2, 358020),
('bos-9_9', 9.9, 18, '10.0', 349470, 321354, 321354, 10.53, 393822, 10.8, 373680),
('bos-10_45', 10.45, 19, '10.0', 364705, 335445, 335445, 11.115, 411255, 11.4, 390450)
ON CONFLICT (id) DO UPDATE SET
    adani_bifi_price = EXCLUDED.adani_bifi_price,
    aps_bifi_price = EXCLUDED.aps_bifi_price,
    rayzone_price = EXCLUDED.rayzone_price,
    waaree_585_price = EXCLUDED.waaree_585_price,
    aps_topcon_600_price = EXCLUDED.aps_topcon_600_price;

-- 3. Inverter Benchmarks Seed
INSERT INTO public.inverter_benchmark_matrix (id, capacity_kw, brand, series, phase, benchmark_price)
VALUES
('inv-bm-1', 2.2, 'Solis / Solaryaan', 'Single Phase Grid-Tied', '1-Phase / Dual MPPT', 24500),
('inv-bm-2', 3.0, 'Sunvine Smart Series', '1-Phase Smart MPPT On-Grid', '1-Phase / Dual MPPT', 29800),
('inv-bm-3', 3.6, 'Solis / Vsole', 'Dual MPPT On-Grid', '1-Phase / Dual MPPT', 33500),
('inv-bm-4', 5.0, 'Sunvine Smart Series', '3-Phase Smart MPPT On-Grid', '3-Phase / Multi MPPT', 42000),
('inv-bm-5', 6.0, 'Sunvine Smart Series', '3-Phase Smart MPPT On-Grid', '3-Phase / Multi MPPT', 48500),
('inv-bm-6', 10.0, 'Growatt / Deye', '3-Phase Dual MPPT On-Grid', '3-Phase / Multi MPPT', 72000),
('inv-bm-7', 50.0, 'Solis Cloud Series', 'Commercial 3-Phase Grid-Tied', '3-Phase / 4-MPPT', 245000),
('inv-bm-8', 125.0, 'Solaryaan / Vsole', 'Industrial String Inverter', '3-Phase / 6-MPPT', 580000)
ON CONFLICT (id) DO UPDATE SET
    benchmark_price = EXCLUDED.benchmark_price;

-- 4. BOM Catalog Seed
INSERT INTO public.bom_catalog (id, capacity_kw, modules_spec, inverter_spec, dc_wire, ac_wire, earthing_wire, la_wire, acdb, dcdb, earthing_kit, pvc_pipes, hardware, mc4_pairs)
VALUES
('bom-2_16', 2.16, '4 (540W)', '2.2 KW', '30 Mtr', '15 Mtr (4 Sqmm)', '25 Mtr (4 Sqmm)', '15 Mtr (10 Sqmm)', '1 Phase', '1 IN 1 OUT', '2 Set', '30 Mtr', 'Including', '2 Pairs'),
('bom-3_24', 3.24, '6 (540W)', '3.3 KW', '30 Mtr', '15 Mtr (4 Sqmm)', '25 Mtr (4 Sqmm)', '15 Mtr (10 Sqmm)', '1 Phase', '1 IN 1 OUT', '2 Set', '30 Mtr', 'Including', '2 Pairs'),
('bom-5_4', 5.4, '10 (540W)', '5.0 KW', '50 Mtr', '25 Mtr (6 Sqmm)', '30 Mtr (6 Sqmm)', '20 Mtr (10 Sqmm)', '3 Phase', '2 IN 2 OUT', '3 Set', '50 Mtr', 'Including', '4 Pairs')
ON CONFLICT (id) DO UPDATE SET
    modules_spec = EXCLUDED.modules_spec,
    inverter_spec = EXCLUDED.inverter_spec;

-- 5. Tier Margins Seed
INSERT INTO public.dealer_custom_pricing (tier_id, tier_name, default_margin_per_kw, max_margin_cap_per_kw, description)
VALUES
('diamond', 'Diamond EPC', 6500, 8000, 'Premier High-Volume Partners (> 5.0 MW/quarter)'),
('platinum', 'Platinum Tier', 5500, 7000, 'Tier-1 Large Scale EPC (> 3.0 MW/quarter)'),
('gold', 'Gold EPC', 4500, 6000, 'Established Standard Installers (1.5 - 3.0 MW/quarter)'),
('silver', 'Silver Installer', 3500, 5000, 'Entry / Regional Empanelled Installers (< 1.5 MW/quarter)')
ON CONFLICT (tier_id) DO UPDATE SET
    default_margin_per_kw = EXCLUDED.default_margin_per_kw,
    max_margin_cap_per_kw = EXCLUDED.max_margin_cap_per_kw;

-- 6. Solar Modules Seed
INSERT INTO public.solar_modules (id, brand, model, wattage, cell_tech, efficiency, rate_per_wp, warranty, is_default)
VALUES
('mod-aps-600', 'APS / Sunvine Premier', '600WP TOPCON MONO BIFACIAL Panel', 600, 'TOPCon Mono Bifacial', '22.8%', '₹ 18.00/Wp', '30 Years Performance', true),
('mod-waaree-585', 'Waaree Energies', '585WP TOPCon Bifacial Dual Glass (HyperIon)', 585, 'TOPCon Mono Bifacial', '22.4%', '₹ 18.25/Wp', '30 Years Performance', false),
('mod-adani-550', 'Adani Solar', 'Elan Bi-550W Mono PERC Half-Cut', 550, 'Mono PERC Bifacial', '21.8%', '₹ 17.80/Wp', '25 Years Performance', false),
('mod-aps-550', 'APS Bi-Fi', '550W Bifacial Dual Glass', 550, 'TOPCon Mono Bifacial', '21.6%', '₹ 17.50/Wp', '25 Years Performance', false),
('mod-rayzone-550', 'Rayzone Solar', '550W Bi-Fi Mono PERC Half-Cut', 550, 'Mono PERC Bifacial', '21.6%', '₹ 17.50/Wp', '25 Years Performance', false)
ON CONFLICT (id) DO UPDATE SET
    brand = EXCLUDED.brand,
    model = EXCLUDED.model,
    wattage = EXCLUDED.wattage,
    rate_per_wp = EXCLUDED.rate_per_wp;

-- 7. Solar Inverters Seed
INSERT INTO public.solar_inverters (id, brand, model, capacity, capacity_kw, phase, efficiency, warranty, is_default)
VALUES
('inv-solis-2_2', 'Solis / Solaryaan', '2.2 KW Single Phase Grid-Tied Inverter', '2.2 kW', 2.2, 'Single Phase', '97.8%', '8 Years Comprehensive', false),
('inv-sunvine-3', 'Sunvine Smart Series', '3.0 KW 1-Phase Smart MPPT On-Grid', '3.0 kW', 3.0, 'Single Phase', '98.0%', '8 Years Comprehensive', true),
('inv-solis-3_6', 'Solis / Vsole', '3.6 KW Single Phase Dual MPPT On-Grid', '3.6 kW', 3.6, 'Single Phase', '98.2%', '8 Years Comprehensive', false),
('inv-sunvine-5', 'Sunvine Smart Series', '5.0 KW 3-Phase Smart MPPT On-Grid', '5.0 kW', 5.0, 'Three Phase', '98.4%', '8 Years Comprehensive', false),
('inv-sunvine-6', 'Sunvine Smart Series', '6.0 KW 3-Phase Smart MPPT On-Grid', '6.0 kW', 6.0, 'Three Phase', '98.4%', '8 Years Comprehensive', false),
('inv-growatt-10', 'Growatt / Deye', '10.0 KW 3-Phase Dual MPPT On-Grid', '10.0 kW', 10.0, 'Three Phase', '98.6%', '8 Years Comprehensive', false),
('inv-solis-50', 'Solis Cloud Series', '50.0 KW 3-Phase Grid-Tied Inverter with Wi-Fi Logger', '50.0 kW', 50.0, 'Three Phase', '98.7%', '8 Years Comprehensive', false),
('inv-solaryaan-125', 'Solaryaan / Solis / Vsole', '125.0 KW String type Three-Phase Grid Tied Inverter', '125.0 kW', 125.0, 'Three Phase', '99.0%', '8 Years Comprehensive', false)
ON CONFLICT (id) DO UPDATE SET
    brand = EXCLUDED.brand,
    model = EXCLUDED.model,
    capacity_kw = EXCLUDED.capacity_kw;

-- 8. Seed Sample Dealers (if not exist)
INSERT INTO public.dealers (dealer_code, firm_name, contact_person, mobile_number, email, password_hash, state, city, discom, status, rating, total_commissioned_mw)
VALUES 
('SV-DLR-0001', 'Rajkot Solar Tech', 'Rajesh Kumar Patel', '9810000000', 'rajeshkumarpatel1@sunvinedealer.in', '$2a$10$zFohdEcKx7PiTLL2.bqckeJhDt9KYh9MEbkp.0CqnPQkhE/2Sl7iK', 'Gujarat', 'Rajkot', 'PGVCL Circle', 'active', 4.9, 0.48),
('SV-DLR-0002', 'Saur Urja Solutions', 'Nilesh Shah', '9810087391', 'nileshshah2@sunvinedealer.in', '$2a$10$zFohdEcKx7PiTLL2.bqckeJhDt9KYh9MEbkp.0CqnPQkhE/2Sl7iK', 'Gujarat', 'Ahmedabad', 'UGVCL / Torrent Power', 'active', 4.8, 0.32),
('SV-DLR-0003', 'Surat Green Energy', 'Paresh Vora', '9825123456', 'paresh@suratgreenenergy.com', '$2a$10$zFohdEcKx7PiTLL2.bqckeJhDt9KYh9MEbkp.0CqnPQkhE/2Sl7iK', 'Gujarat', 'Surat', 'DGVCL', 'active', 5.0, 1.10)
ON CONFLICT (dealer_code) DO NOTHING;

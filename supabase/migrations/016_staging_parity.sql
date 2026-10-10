-- ====================================================================
-- 016_staging_parity.sql
-- Sunvine Renewable Energy — Staging & Production Schema Parity Migration
-- Ensures Staging DB (voyargkmlkrlidyxjcbk) and Production DB (wyberzvcyrjipjqpotwe)
-- have identical 23 tables, complete column alignment, and strict RLS.
-- ====================================================================

-- 1. Create table: bom_catalog_items (if not exists)
CREATE TABLE IF NOT EXISTS public.bom_catalog_items (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'structure',
    make VARCHAR(100) NOT NULL DEFAULT 'STANDARD',
    unit VARCHAR(20) NOT NULL DEFAULT 'NOS',
    default_rate NUMERIC(10,2) NOT NULL DEFAULT 100.00,
    gst_rate NUMERIC(4,2) NOT NULL DEFAULT 18.00,
    specs TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 100,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create table: dealer_product_overrides (if not exists)
CREATE TABLE IF NOT EXISTS public.dealer_product_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID NOT NULL,
    product_type VARCHAR(50) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    custom_rate NUMERIC(10,2) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(dealer_id, product_type, product_id)
);

-- 3. Create table: solar_kits_presets (if not exists)
CREATE TABLE IF NOT EXISTS public.solar_kits_presets (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    capacity_kw NUMERIC(6,2) NOT NULL,
    panel_wattage INTEGER,
    panel_count INTEGER,
    inverter_capacity_kw NUMERIC(6,2),
    base_price NUMERIC(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Ensure RLS is active on the 3 parity tables
ALTER TABLE public.bom_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_product_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_kits_presets ENABLE ROW LEVEL SECURITY;

-- 5. Revoke write permissions from public/anon
REVOKE ALL ON public.bom_catalog_items FROM anon, public;
REVOKE ALL ON public.dealer_product_overrides FROM anon, public;
REVOKE ALL ON public.solar_kits_presets FROM anon, public;

-- Allow read-only for catalogue tables to anon
DO $$ BEGIN
    CREATE POLICY "anon_read_bom_items" ON public.bom_catalog_items FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_read_solar_kits" ON public.solar_kits_presets FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Ensure column alignment across existing tables
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255);
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS request_id UUID UNIQUE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;
ALTER TABLE public.staff_accounts ADD COLUMN IF NOT EXISTS is_verification BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS assigned_staff_id VARCHAR(100) DEFAULT 'STF-DIRECT';
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS assigned_staff_name VARCHAR(255) DEFAULT 'Direct to Company (HQ Desk)';

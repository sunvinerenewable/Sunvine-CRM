-- ====================================================================
-- Migration: 005_dealer_financial_ledger.sql
-- Sunvine Renewable Energy (Rajkot Hub)
-- Purpose:
--   1. Dual-Entry (Dr. / Cr.) Banking-Grade Ledger for Dealer Accounting
--   2. Dual Dealer Model: kit_based vs margin_based + Commission & Registration fees
-- ====================================================================

-- 1. Extend dealer_accounts with dealer_type and financial properties
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS dealer_type VARCHAR(50) DEFAULT 'margin_based';
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS default_commission_per_kw NUMERIC(10,2) DEFAULT 2000.00;
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS registration_fee_rate NUMERIC(10,2) DEFAULT 2500.00;
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS distance_from_rajkot_km NUMERIC(10,1) DEFAULT 0.0;

-- 2. Dual-Entry Financial Ledger Table (Dr. Debit / Cr. Credit)
CREATE TABLE IF NOT EXISTS public.dealer_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_no VARCHAR(50) UNIQUE NOT NULL,
    dealer_id UUID REFERENCES public.dealer_accounts(id) ON DELETE CASCADE,
    dealer_code VARCHAR(50),
    dealer_name VARCHAR(255) NOT NULL,
    customer_file_id VARCHAR(50),
    customer_name VARCHAR(255),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'KIT_DISPATCH',          -- Dr: Company billed hardware kit to dealer (Dealer owes Sunvine)
        'PAYMENT_RECEIVED',      -- Cr: Dealer paid money to company (NEFT/RTGS/UPI/Cash)
        'COMMISSION_PAYABLE',    -- Cr: Company owes commission to margin dealer
        'COMMISSION_PAID',       -- Dr: Company disbursed commission to margin dealer
        'REGISTRATION_FEE',      -- Dr: Company charged subsidy portal registration fee
        'ADJUSTMENT'             -- General debit/credit adjustment
    )),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_mode VARCHAR(50) DEFAULT 'BANK_TRANSFER', -- 'NEFT', 'RTGS', 'UPI', 'CASH', 'CHEQUE', 'SYSTEM_BILL'
    reference_no VARCHAR(100), -- UTR number / Cheque No / Invoice No
    narration TEXT NOT NULL,
    proof_url TEXT,
    created_by VARCHAR(100) DEFAULT 'Super Administrator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indices for instant query performance
CREATE INDEX IF NOT EXISTS idx_dealer_ledger_dealer_id ON public.dealer_ledger_entries(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_ledger_entry_date ON public.dealer_ledger_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_dealer_ledger_voucher ON public.dealer_ledger_entries(voucher_no);

-- Row Level Security
ALTER TABLE public.dealer_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select dealer_ledger_entries" ON public.dealer_ledger_entries;
CREATE POLICY "Allow select dealer_ledger_entries" ON public.dealer_ledger_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow modify dealer_ledger_entries" ON public.dealer_ledger_entries;
CREATE POLICY "Allow modify dealer_ledger_entries" ON public.dealer_ledger_entries FOR ALL USING (true);

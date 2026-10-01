-- ════════════════════════════════════════════════════════════════════════════
-- Migration 001: Add numeric price columns to hardware catalog tables
-- Purpose: solar_modules.rate_per_wp and solar_inverters.base_price are
--          stored as VARCHAR strings (e.g. '₹ 19.20/Wp'). This is a
--          data-type defect. We add parallel NUMERIC columns and backfill
--          by parsing the formatted strings.
--
-- STATUS: NOT EXECUTED — apply to staging first, then production.
-- Apply with: psql $DATABASE_URL -f supabase/migrations/001_numeric_prices.sql
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── solar_modules ────────────────────────────────────────────────────────────
ALTER TABLE public.solar_modules
  ADD COLUMN IF NOT EXISTS rate_per_wp_inr NUMERIC(8,4);

-- Backfill: extract the numeric value from strings like '₹ 18.00/Wp', '19.20', etc.
UPDATE public.solar_modules
SET rate_per_wp_inr = (
  regexp_replace(rate_per_wp, '[^0-9.]', '', 'g')::NUMERIC
)
WHERE rate_per_wp_inr IS NULL
  AND rate_per_wp ~ '[0-9]+\.?[0-9]*';

-- Log rows that could not be parsed (null after backfill)
DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM public.solar_modules WHERE rate_per_wp_inr IS NULL;
  IF bad_count > 0 THEN
    RAISE WARNING '001_numeric_prices: % solar_modules rows have unparseable rate_per_wp; fix manually.', bad_count;
  END IF;
END $$;

-- ── solar_inverters ──────────────────────────────────────────────────────────
ALTER TABLE public.solar_inverters
  ADD COLUMN IF NOT EXISTS base_price VARCHAR(50),
  ADD COLUMN IF NOT EXISTS base_price_inr NUMERIC(12,2);

-- Backfill from inverter_benchmark_matrix by matching capacity_kw
UPDATE public.solar_inverters i
SET 
  base_price_inr = bm.benchmark_price,
  base_price = '₹ ' || to_char(bm.benchmark_price, 'FM999,999,999.00')
FROM public.inverter_benchmark_matrix bm
WHERE i.capacity_kw = bm.capacity_kw
  AND (i.base_price_inr IS NULL OR i.base_price IS NULL);

-- Fallback regex backfill for any rows with base_price string but missing base_price_inr
UPDATE public.solar_inverters
SET base_price_inr = (
  regexp_replace(base_price, '[^0-9.]', '', 'g')::NUMERIC
)
WHERE base_price_inr IS NULL
  AND base_price IS NOT NULL
  AND base_price ~ '[0-9]+\.?[0-9]*';

DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM public.solar_inverters WHERE base_price_inr IS NULL;
  IF bad_count > 0 THEN
    RAISE WARNING '001_numeric_prices: % solar_inverters rows have unparseable base_price; fix manually.', bad_count;
  END IF;
END $$;

-- NOTE: Old string columns (rate_per_wp, base_price) are kept for now.
-- Remove them in a later migration once all code paths use the new columns.

COMMIT;

-- Verification query (run after applying):
-- SELECT id, brand, rate_per_wp, rate_per_wp_inr FROM public.solar_modules WHERE rate_per_wp_inr IS NULL;
-- SELECT id, brand, base_price, base_price_inr FROM public.solar_inverters WHERE base_price_inr IS NULL;

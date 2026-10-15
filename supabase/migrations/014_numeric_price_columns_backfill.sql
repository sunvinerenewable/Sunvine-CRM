-- ════════════════════════════════════════════════════════════════════════════
-- Migration 014: Additive Numeric Price Columns Backfill
-- Directives: Data Integrity & Typed Pricing
--
-- This migration:
-- 1. Ensures rate_per_wp_inr (NUMERIC(8,4)) exists on solar_modules and backfills
--    any unpopulated rows from legacy rate_per_wp varchar strings.
-- 2. Ensures base_price_inr (NUMERIC(12,2)) exists on solar_inverters and backfills
--    from inverter_benchmark_matrix or legacy base_price varchar strings.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Solar Modules Numeric Backfill ────────────────────────────────────────
ALTER TABLE public.solar_modules
  ADD COLUMN IF NOT EXISTS rate_per_wp_inr NUMERIC(8,4);

-- Backfill from rate_per_wp string column (e.g. '₹ 19.20/Wp', '18.50', '22')
UPDATE public.solar_modules
SET rate_per_wp_inr = (
  regexp_replace(rate_per_wp, '[^0-9.]', '', 'g')::NUMERIC
)
WHERE rate_per_wp_inr IS NULL
  AND rate_per_wp IS NOT NULL
  AND rate_per_wp ~ '[0-9]+\.?[0-9]*';

-- ── 2. Solar Inverters Numeric Backfill ──────────────────────────────────────
ALTER TABLE public.solar_inverters
  ADD COLUMN IF NOT EXISTS base_price VARCHAR(50),
  ADD COLUMN IF NOT EXISTS base_price_inr NUMERIC(12,2);

-- Primary backfill: match benchmark pricing by capacity_kw if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inverter_benchmark_matrix') THEN
    UPDATE public.solar_inverters i
    SET 
      base_price_inr = bm.benchmark_price,
      base_price = COALESCE(i.base_price, '₹ ' || to_char(bm.benchmark_price, 'FM999,999,999.00'))
    FROM public.inverter_benchmark_matrix bm
    WHERE i.capacity_kw = bm.capacity_kw
      AND i.base_price_inr IS NULL;
  END IF;
END $$;

-- Secondary backfill: parse numeric values from base_price string column
UPDATE public.solar_inverters
SET base_price_inr = (
  regexp_replace(base_price, '[^0-9.]', '', 'g')::NUMERIC
)
WHERE base_price_inr IS NULL
  AND base_price IS NOT NULL
  AND base_price ~ '[0-9]+\.?[0-9]*';

-- ── 3. Diagnostic warnings for unparseable legacy records ────────────────────
DO $$
DECLARE
  bad_modules INT;
  bad_inverters INT;
BEGIN
  SELECT COUNT(*) INTO bad_modules FROM public.solar_modules WHERE rate_per_wp_inr IS NULL;
  IF bad_modules > 0 THEN
    RAISE WARNING 'Migration 014: % solar_modules rows have NULL rate_per_wp_inr after backfill.', bad_modules;
  END IF;

  SELECT COUNT(*) INTO bad_inverters FROM public.solar_inverters WHERE base_price_inr IS NULL;
  IF bad_inverters > 0 THEN
    RAISE WARNING 'Migration 014: % solar_inverters rows have NULL base_price_inr after backfill.', bad_inverters;
  END IF;
END $$;

COMMIT;

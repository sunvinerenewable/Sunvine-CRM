-- Migration 019: Widen public.quotations column lengths to prevent overflow errors
ALTER TABLE public.quotations ALTER COLUMN inverter_type TYPE VARCHAR(255);
ALTER TABLE public.quotations ALTER COLUMN panel_type TYPE VARCHAR(255);
ALTER TABLE public.quotations ALTER COLUMN structure_type TYPE VARCHAR(255);
ALTER TABLE public.quotations ALTER COLUMN dealer_code TYPE VARCHAR(50);
ALTER TABLE public.quotations ALTER COLUMN customer_city TYPE VARCHAR(255);
ALTER TABLE public.quotations ALTER COLUMN customer_state TYPE VARCHAR(255);

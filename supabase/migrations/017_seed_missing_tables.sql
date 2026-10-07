-- ====================================================================
-- 017_seed_missing_tables.sql
-- Seeds default data into bom_catalog_items and solar_kits_presets
-- ====================================================================

-- 1. SEED DATA: FIELD BOM CATALOG ITEMS (20 Standard Items)
INSERT INTO public.bom_catalog_items (id, name, category, make, unit, default_rate, gst_rate, specs, is_active, sort_order)
VALUES
    ('gi_pipe_60x40', '60X40 Hot Dip Galvanized Structural Pipe', 'structure', 'Fortune / Jindal (HDGI)', 'Meter', 85.00, 18.00, '60X40, 18 KW Structure Grade', true, 10),
    ('gi_pipe_40x40', '40X40 Hot Dip Galvanized Structural Pipe', 'structure', 'Fortune / Jindal (HDGI)', 'Meter', 84.00, 18.00, '40X40, 15 KW Structure Grade', true, 20),
    ('stud_12x2m', '12*2MTR Threaded Stud Grade 8.8', 'structure', 'Grade 8.8 / Standard', 'Nos', 140.00, 18.00, 'SS 304 / Grade 8.8 Structural Stud', true, 30),
    ('fastener', 'Heavy-Duty RCC Rooftop Anchor Fastener', 'structure', 'Hilti / Fischer / Reputed', 'Nos', 15.00, 18.00, 'M10 / M12 RCC Heavy Duty Anchor', true, 40),
    ('ms_j_bolt', 'HDGI J-Bolt for 40x40 Pipe Clamping', 'structure', 'HDGI Standard', 'Nos', 15.00, 18.00, '40x40 Pipe Clamp with Washers', true, 50),
    ('ms_angels', 'MS Galvanized Structural L-Angle Bracket (LA Patti)', 'structure', 'Tata / Jindal', 'Nos', 35.00, 18.00, 'MS Galvanized / LA Patti Bracing', true, 60),
    ('nut_washer', 'SS Nut & Spring Washers Set', 'structure', 'SS 304 / Grade 8.8', 'Nos', 2.50, 18.00, 'SS 304 Flat & Spring Washer Set', true, 70),
    ('zinc_spray', 'Cold Galvanizing Zinc Anti-Rust Spray Can', 'structure', '3M / Rust-Oleum', 'Can', 130.00, 18.00, 'Anti-Rust Coating (200-400ml)', true, 80),
    ('acdb_dcdb_combo', 'ASG ACDB / DCDB Dual Protection Box Combo', 'electrical', 'ASG / L&T / Schneider', 'Set', 1650.00, 18.00, '1kW - 6kW IP65 with SPD & MCB', true, 90),
    ('mc4_connector', 'MC4 Solar Connectors Pair (Male + Female)', 'electrical', 'Staubli / Multi-Contact', 'Nos', 35.00, 5.00, '1500V DC UV Resistant Connectors', true, 100),
    ('dc_wire_4sqmm', 'DC Solar Cable 4 Sq.mm Copper (EN 50618 Red/Black)', 'cables', 'Polycab / RR Kabel', 'Meter', 60.00, 18.00, 'TUV Certified 1-Core Solar Wire', true, 110),
    ('ac_wire_4sqmm', 'AC Cable 4 Sq.mm Heavy-Duty Copper 3/4-Core', 'cables', 'Polycab / Havells', 'Meter', 58.00, 18.00, 'IS 694 ISI Marked AC Wire', true, 120),
    ('earthing_cable', 'Earthing Cable 4 Sq.mm Pure Copper Wire', 'cables', 'Polycab / RR Kabel', 'Meter', 35.00, 18.00, 'Green PVC Insulated Earthing Cable', true, 130),
    ('la_cable', 'Lightning Arrestor Down Conductor 16 Sq.mm', 'cables', 'Polycab / Vasundhara', 'Meter', 20.00, 18.00, '1-Core 16 Sq.mm Down Conductor', true, 140),
    ('earthing_kit', 'Chemical Earthing Kit (Electrode + BFC Compound)', 'electrical', 'Vasundhara / Chemical Gel', 'Nos', 650.00, 18.00, 'Maintenance-Free IS 3043 Gel Earthing', true, 150),
    ('pvc_pipe_25mm', '25mm Heavy Duty PVC Conduit Pipe', 'conduits', 'Polycab / Precision', 'Nos', 45.00, 18.00, 'Rigid UV-Resistant Conduit (3Mtr)', true, 160),
    ('pvc_elbow_25mm', '25mm Heavy PVC Elbow Fittings', 'conduits', 'Polycab', 'Nos', 6.00, 18.00, 'Precision Conduit 90 Deg Elbow', true, 170),
    ('pvc_tee_25mm', '25mm Heavy PVC Tee Junction Fittings', 'conduits', 'Polycab', 'Nos', 5.00, 18.00, 'Precision Conduit Tee Junction', true, 180),
    ('shadel_clamp', 'Heavy Duty GI Saddle Clamps Packet', 'conduits', 'Heavy Duty GI', 'Pkt', 120.00, 18.00, 'Packet of 50 Pcs Clamps with Screws', true, 190),
    ('transportation', 'Insured Safe Freight & Doorstep Delivery', 'logistics', 'Sunvine Logistics', 'Set', 1000.00, 0.00, 'Direct-to-site insured transit', true, 200)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    default_rate = EXCLUDED.default_rate,
    gst_rate = EXCLUDED.gst_rate,
    specs = EXCLUDED.specs,
    updated_at = now();

-- 2. SEED DATA: SOLAR KITS PRESETS
INSERT INTO public.solar_kits_presets (id, name, capacity_kw, panel_wattage, panel_count, inverter_capacity_kw, base_price)
VALUES
    ('kit_3_3kw', 'Sunvine 3.3 kW Premier Residential Kit', 3.30, 550, 6, 3.60, 127500.00),
    ('kit_4_4kw', 'Sunvine 4.4 kW Premier Residential Kit', 4.40, 550, 8, 4.40, 170200.00),
    ('kit_5_5kw', 'Sunvine 5.5 kW Premier Residential Kit', 5.50, 550, 10, 5.00, 203926.00),
    ('kit_6_6kw', 'Sunvine 6.6 kW Premier Residential Kit', 6.60, 550, 12, 6.00, 244530.00)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    capacity_kw = EXCLUDED.capacity_kw,
    panel_wattage = EXCLUDED.panel_wattage,
    panel_count = EXCLUDED.panel_count,
    inverter_capacity_kw = EXCLUDED.inverter_capacity_kw,
    base_price = EXCLUDED.base_price,
    updated_at = now();

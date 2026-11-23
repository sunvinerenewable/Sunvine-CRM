-- Update the approved central subsidy for new 2.18 kW package quotations.
-- Existing quotation snapshots retain their original amounts.
update public.residential_package_settings
set central_subsidy = 63240
where id = 'residential-218' and central_subsidy = 62800;

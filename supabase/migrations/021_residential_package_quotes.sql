create table if not exists public.residential_package_settings (
  id text primary key check (id = 'residential-218'),
  adani_price integer not null check (adani_price > 0),
  waaree_price integer not null check (waaree_price > 0),
  central_subsidy integer not null check (central_subsidy >= 0),
  general_subsidy integer not null check (general_subsidy >= 0),
  sc_st_subsidy integer not null check (sc_st_subsidy >= 0),
  bom jsonb not null,
  check (central_subsidy::bigint + greatest(general_subsidy, sc_st_subsidy) <= least(adani_price, waaree_price))
);

insert into public.residential_package_settings values (
  'residential-218', 110512, 116854, 62800, 33600, 38960,
  '[
    {"name":"545 Wp mono bifacial PV module","qty":"4","make":"Adani / Waaree"},
    {"name":"2.2 kW single-phase grid-tied string inverter","qty":"1","make":"VSOLE / reputed make"},
    {"name":"Hot-dip galvanized pipe, 2 mm, 60/80 micron, 60 × 40 / 40 × 40","qty":"As per requirement","make":"Fortune / Hindustar"},
    {"name":"Stainless steel J-bolt","qty":"As per requirement","make":"Reputed make"},
    {"name":"Anchor fastener","qty":"As per requirement","make":"Reputed make"},
    {"name":"4 sq. mm single-core DC cable, red and black, with tape and fixings","qty":"As per requirement","make":"Polycab / reputed make"},
    {"name":"AC copper flex, aluminium armoured cable and 4 sq. mm earthing cable","qty":"As per requirement","make":"Polycab / reputed make"},
    {"name":"ACDB and DCDB","qty":"1 each","make":"L&T / Havells / Schneider"},
    {"name":"16 sq. mm single-core lightning arrestor cable","qty":"As per requirement","make":"Polycab / reputed make"},
    {"name":"Earthing rod and lightning arrestor","qty":"As per requirement","make":"Vasundhara"},
    {"name":"Stud, nut, washer, cable ties, PVC elbows, saddle clips, pipe and fittings","qty":"As per requirement","make":""}
  ]'::jsonb
) on conflict (id) do nothing;

create table if not exists public.residential_package_quotes (
  id uuid primary key,
  created_by text not null,
  customer_name text not null,
  phone text not null,
  address text,
  city text not null,
  category text not null check (category in ('General / OBC', 'SC / ST')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.customer_files
  add column if not exists residential_package_quote_id uuid unique references public.residential_package_quotes(id),
  add column if not exists residential_package_brand text,
  add column if not exists residential_package_price integer;

alter table public.residential_package_settings enable row level security;
alter table public.residential_package_quotes enable row level security;
revoke all on public.residential_package_settings, public.residential_package_quotes from public, anon, authenticated;
grant select, update on public.residential_package_settings to service_role;
grant select, insert on public.residential_package_quotes to service_role;

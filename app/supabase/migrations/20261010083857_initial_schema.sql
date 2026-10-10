-- Initial schema (PRD "Data model"): stations, places near them, and paid #1 Featured listings.
-- Apply with: npx supabase db push --db-url "$DATABASE_URL"

create extension if not exists postgis with schema extensions;

-- Tesla Superchargers, upserted by OSM id from the import job.
create table public.stations (
  id text primary key, -- OSM element, e.g. n12944744239
  slug text not null unique,
  state text not null, -- lowercase 2-letter code ("us" when OSM has no state)
  city text not null, -- city slug ("unlisted" when unknown)
  name text not null,
  city_label text, -- "Austin, TX" from the station's own address
  near_label text, -- no address in OSM: the nearest station's city
  street text,
  address text,
  lat double precision not null,
  lon double precision not null,
  location extensions.geography(point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)::extensions.geography) stored,
  stalls integer check (stalls > 0),
  max_kw integer check (max_kw > 0),
  ccs boolean not null default false, -- CCS (Magic Dock) connector: non-Tesla EVs can plug in
  price_per_kwh numeric(6, 3), -- unknown until a price source is chosen
  active boolean not null default true, -- stations that disappear from OSM are deactivated, not deleted
  updated_at timestamptz not null default now()
);

create index stations_location_idx on public.stations using gist (location);
create index stations_state_city_idx on public.stations (state, city);

-- Places within walking distance (and other EV chargers within about a mile).
create table public.places (
  id bigint generated always as identity primary key,
  osm_id text unique, -- filled in by the nightly job; the first snapshot has none
  name text not null,
  category text not null check (category in ('food', 'coffee', 'grocery', 'bars', 'shops', 'chargers')),
  kind text not null, -- "Restaurant", "Café", "DC fast charging"…
  lat double precision not null,
  lon double precision not null,
  location extensions.geography(point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)::extensions.geography) stored,
  opening_hours text,
  updated_at timestamptz not null default now(),
  unique (category, name, lat, lon)
);

create index places_location_idx on public.places using gist (location);

-- Precomputed distances (PRD: walk time at 80 m per minute).
create table public.station_places (
  station_id text not null references public.stations (id) on delete cascade,
  place_id bigint not null references public.places (id) on delete cascade,
  distance_m integer not null check (distance_m >= 0),
  walk_min integer not null check (walk_min >= 1),
  primary key (station_id, place_id)
);

create index station_places_place_idx on public.station_places (place_id);

-- Paid #1 Featured listings, from business applications or added by us.
create table public.featured_listings (
  id uuid primary key default gen_random_uuid(),
  station_id text not null references public.stations (id) on delete cascade,
  category text not null check (category in ('food', 'coffee', 'grocery', 'bars', 'shops', 'chargers')),
  business_name text not null check (char_length(business_name) between 2 and 80),
  kind text not null,
  offer_text text not null check (char_length(offer_text) <= 50), -- PRD: max 50 characters
  cta_label text not null,
  cta_url text not null check (cta_url like 'https://%'),
  address text,
  distance_m integer,
  lat double precision,
  lon double precision,
  contact_name text not null,
  contact_email text not null,
  phone text,
  status text not null default 'pending' check (status in ('pending', 'live', 'paused', 'rejected')),
  source text not null check (source in ('business', 'admin')),
  stripe_subscription_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PRD: one featured business per category per station, enforced by the database itself.
create unique index featured_one_live_per_slot
  on public.featured_listings (station_id, category)
  where status = 'live';

create index featured_station_idx on public.featured_listings (station_id);

-- Row Level Security: the site reads and writes through its server-side database connection,
-- never through Supabase's public API, so no policies are granted. With RLS on and no policies,
-- the publishable (anon) key can't read anything here, including businesses' contact details.
alter table public.stations enable row level security;
alter table public.places enable row level security;
alter table public.station_places enable row level security;
alter table public.featured_listings enable row level security;

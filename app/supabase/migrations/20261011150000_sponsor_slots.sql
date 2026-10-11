-- Three paid spots per station and category: #1 Featured, #2 and #3 Sponsored.
-- Apply with: npx supabase db push --db-url "$DATABASE_URL"

-- Existing listings held the #1 spot.
alter table public.featured_listings
  add column slot smallint not null default 1 check (slot between 1 and 3);

-- One live business per spot (was: per station and category).
drop index if exists public.featured_one_live_per_slot;
create unique index featured_one_live_per_slot
  on public.featured_listings (station_id, category, slot)
  where status = 'live';

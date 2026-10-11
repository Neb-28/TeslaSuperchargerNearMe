-- Optional accounts (Supabase Auth, email code sign-in): favorites synced across devices, and
-- businesses see their own Featured requests (matched by the email they signed in with).
-- Apply with: npx supabase db push --db-url "$DATABASE_URL"

-- Saved stations per account. Name, address and link are copied from the station so favorites for
-- stations outside the US (not in public.stations) work too.
create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  station_id text not null check (char_length(station_id) between 1 and 64),
  name text not null check (char_length(name) <= 200),
  address text check (char_length(address) <= 300),
  href text not null check (href like '/supercharger/%' and char_length(href) <= 300),
  created_at timestamptz not null default now(),
  primary key (user_id, station_id)
);

-- The browser reads and writes favorites directly with the visitor's session, so Row Level
-- Security is what keeps each account to its own rows.
alter table public.favorites enable row level security;

create policy "Read own favorites" on public.favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own favorites" on public.favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Change own favorites" on public.favorites
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Remove own favorites" on public.favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.favorites from anon;
grant select, insert, update, delete on public.favorites to authenticated;

-- Featured listings can be for stations outside the US, which aren't in public.stations.
alter table public.featured_listings drop constraint if exists featured_listings_station_id_fkey;

-- Business dashboard: a business's requests, by the email they applied with.
create index featured_contact_email_idx on public.featured_listings (lower(contact_email));

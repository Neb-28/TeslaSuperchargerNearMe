-- Driver photos of stations (PRD "Station photos"): uploaded from a station page, shown only
-- after an admin approves them on /admin. Rejected photos are deleted, record and files.
-- Apply with: npx supabase db push --db-url "$DATABASE_URL"
create table public.station_photos (
  id uuid primary key default gen_random_uuid(),
  station_id text not null,
  -- Paths inside the station-photos storage bucket: the photo (at most 1600 px) and its thumbnail.
  photo_path text not null,
  thumb_path text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  caption text check (char_length(caption) <= 120),
  -- The uploader's email, for questions about the photo. Never shown on the site.
  email text not null,
  -- Keyed hash of the uploader's IP address, only for the daily upload limit.
  ip_hash text not null,
  -- Automatic blurring of faces and license plates: done (with how many areas), nothing found,
  -- skipped (no GOOGLE_VISION_API_KEY) or failed. Admins check skipped and failed photos closely.
  blur_status text not null check (blur_status in ('blurred', 'none_found', 'skipped', 'failed')),
  blurred_areas integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index station_photos_station_idx on public.station_photos (station_id, status, created_at desc);
create index station_photos_status_idx on public.station_photos (status, created_at desc);
create index station_photos_email_idx on public.station_photos (lower(email), created_at desc);
create index station_photos_ip_idx on public.station_photos (ip_hash, created_at desc);

-- Server-side connection only, like every other table: RLS on with no policies keeps uploaders'
-- emails away from the public (anon) key.
alter table public.station_photos enable row level security;

-- Public bucket: anyone can open a photo by its address (random, never listed), and the CDN caches
-- them. Only the server, with the service role key, can add or delete files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('station-photos', 'station-photos', true, 5242880, array['image/webp'])
on conflict (id) do nothing;

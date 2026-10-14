-- Messages sent through the Contact page form; read on /admin.
-- Apply with: npx supabase db push --db-url "$DATABASE_URL"
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text check (char_length(last_name) <= 60),
  email text not null,
  phone text,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create index contact_messages_created_idx on public.contact_messages (created_at desc);

-- Server-side connection only, like every other table: RLS on with no policies keeps visitors'
-- names, emails and phone numbers away from the public (anon) key.
alter table public.contact_messages enable row level security;

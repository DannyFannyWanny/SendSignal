-- Enable Row Level Security
alter table if exists public.profiles enable row level security;
alter table if exists public.presence enable row level security;

-- profiles: minimal public profile
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  created_at timestamptz default now()
);

-- presence: ephemeral online status + last known location
create table if not exists public.presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_open boolean not null default false,
  lat double precision,
  lng double precision,
  updated_at timestamptz not null default now()
);

-- helpful index
create index if not exists idx_presence_updated_at on public.presence(updated_at);

-- Row Level Security Policies

-- profiles policies
create policy "Users can view all profiles" on public.profiles
  for select using (true);

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- presence policies
create policy "Users can view all presence" on public.presence
  for select using (true);

create policy "Users can insert their own presence" on public.presence
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own presence" on public.presence
  for update using (auth.uid() = user_id);

-- Postgres function to "touch" presence safely
create or replace function public.upsert_presence(_is_open boolean, _lat double precision, _lng double precision)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.presence as p (user_id, is_open, lat, lng, updated_at)
  values (auth.uid(), _is_open, _lat, _lng, now())
  on conflict (user_id) do update
    set is_open = excluded.is_open,
        lat = excluded.lat,
        lng = excluded.lng,
        updated_at = now();
end;
$$;

-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
--
-- The important part is row-level security. The anon key ships inside the app
-- and is meant to be public; it grants nothing on its own. RLS is the only
-- thing standing between one user and another user's data, so every policy
-- below is scoped to auth.uid().

create table if not exists public.workout_sessions (
  id            uuid primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  started_at    timestamptz not null,
  ended_at      timestamptz,
  total_reps    integer not null default 0,
  best_set      integer not null default 0,
  counting_mode text    not null default 'manual',
  is_verified   boolean not null default false,
  program_slug  text,
  created_at    timestamptz not null default now()
);

-- Most reads are "my history, newest first".
create index if not exists workout_sessions_user_started_idx
  on public.workout_sessions (user_id, started_at desc);

alter table public.workout_sessions enable row level security;

drop policy if exists "read own sessions" on public.workout_sessions;
create policy "read own sessions" on public.workout_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "insert own sessions" on public.workout_sessions;
create policy "insert own sessions" on public.workout_sessions
  for insert with check (auth.uid() = user_id);

-- Needed as well as insert: the client upserts, and an upsert that collides
-- performs an update.
drop policy if exists "update own sessions" on public.workout_sessions;
create policy "update own sessions" on public.workout_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own sessions" on public.workout_sessions;
create policy "delete own sessions" on public.workout_sessions
  for delete using (auth.uid() = user_id);

-- A profile row per user, created automatically on signup so the app never
-- has to handle "signed in but no profile yet".
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  daily_goal   integer not null default 25,
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "upsert own profile" on public.profiles;
create policy "upsert own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

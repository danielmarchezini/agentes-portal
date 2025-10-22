-- Add optional columns to profiles for status and last_login
-- Safe to run multiple times thanks to IF NOT EXISTS
alter table if exists public.profiles
  add column if not exists status text default 'active',
  add column if not exists last_login timestamptz;

-- Optional: create indexes to improve filtering
create index if not exists profiles_status_idx on public.profiles(status);
create index if not exists profiles_org_idx on public.profiles(organization_id);

-- No RLS changes required assuming existing table policies

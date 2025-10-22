-- Enable RLS and restrict system_owners management to system admins
alter table if exists public.system_owners enable row level security;

drop policy if exists "system owners read" on public.system_owners;
create policy "system owners read" on public.system_owners
  for select
  to anon, authenticated
  using (true);

-- Only system admins can insert/delete
drop policy if exists "system owners manage" on public.system_owners;
create policy "system owners manage" on public.system_owners
  for all
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

-- System owners table and updated admin function
create table if not exists public.system_owners (
  email text primary key,
  created_at timestamptz not null default now()
);

comment on table public.system_owners is 'Allowlist of emails that are considered system admins (global owners).';

-- Seed initial owner (adjust as needed)
insert into public.system_owners(email)
values ('dmarchezini@gmail.com')
on conflict (email) do nothing;

-- Update is_system_admin() to rely on profiles.role = ''owner'' OR email in system_owners
create or replace function public.is_system_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'owner' or
        exists (select 1 from public.system_owners so where lower(so.email) = lower(p.email))
      )
  );
$$;

grant select on table public.system_owners to anon, authenticated, service_role;
grant execute on function public.is_system_admin() to anon, authenticated, service_role;

-- Organization invited admins and enhanced new user handling

-- Table to store invited admins (or roles) by email per organization
create table if not exists public.organization_invited_admins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'admin',
  created_at timestamptz default now()
);

create unique index if not exists org_invited_admins_org_email_idx
  on public.organization_invited_admins(organization_id, lower(email));

alter table public.organization_invited_admins enable row level security;

-- Policies: only system admin can manage invites globally
drop policy if exists "system admin full access to invited admins" on public.organization_invited_admins;
create policy "system admin full access to invited admins" on public.organization_invited_admins
  for all using (public.is_system_admin()) with check (public.is_system_admin());

-- Update handle_new_user to honor invites (priority over domain matching)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text;
  v_org_id uuid;
  v_name text;
  v_invited_role public.user_role;
  v_invited_org uuid;
begin
  v_domain := lower(split_part(new.email, '@', 2));
  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  -- Check explicit invites first (takes precedence)
  select organization_id, role into v_invited_org, v_invited_role
  from public.organization_invited_admins
  where lower(email) = lower(new.email)
  limit 1;

  if v_invited_org is not null then
    v_org_id := v_invited_org;
  else
    -- Fallback: resolve org by domain (organization_domains first, then organizations.domain)
    select o.id into v_org_id
    from public.organization_domains od
    join public.organizations o on o.id = od.organization_id
    where v_domain = lower(od.domain)
       or v_domain like ('%.' || lower(od.domain))
    limit 1;

    if v_org_id is null then
      select o.id into v_org_id
      from public.organizations o
      where v_domain = lower(o.domain)
         or v_domain like ('%.' || lower(o.domain))
      limit 1;
    end if;
  end if;

  -- Upsert profile with role priority: invited role > default member
  insert into public.profiles (id, email, name, role, status, organization_id)
  values (new.id, new.email, v_name, coalesce(v_invited_role, 'member'), 'active', v_org_id)
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(excluded.name, public.profiles.name),
        role = coalesce(v_invited_role, public.profiles.role),
        organization_id = coalesce(excluded.organization_id, public.profiles.organization_id);

  -- Optionally, consume the invite (delete) so it cannot be reused
  if v_invited_org is not null then
    delete from public.organization_invited_admins
    where organization_id = v_invited_org and lower(email) = lower(new.email);
  end if;

  return new;
end;
$$;

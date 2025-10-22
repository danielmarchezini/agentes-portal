-- Update handle_new_user() to respect system owners and avoid org assignment
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
begin
  -- Extract domain and a friendly name
  v_domain := lower(split_part(new.email, '@', 2));
  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  -- If the email is a system owner, ensure role='owner' and do NOT set organization_id
  if exists (select 1 from public.system_owners so where lower(so.email) = lower(new.email)) then
    insert into public.profiles (id, email, name, role, status, organization_id)
    values (new.id, new.email, v_name, 'owner', 'active', null)
    on conflict (id) do update
      set email = excluded.email,
          name = coalesce(excluded.name, public.profiles.name),
          role = 'owner',
          organization_id = null;
    return new;
  end if;

  -- Try organization_domains first, fallback to organizations.domain
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

  -- Upsert profile for non-owners
  insert into public.profiles (id, email, name, role, status, organization_id)
  values (new.id, new.email, v_name, 'member', 'active', v_org_id)
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(excluded.name, public.profiles.name),
        organization_id = coalesce(excluded.organization_id, public.profiles.organization_id);

  return new;
end;
$$;

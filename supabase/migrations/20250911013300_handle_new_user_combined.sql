-- Combined handle_new_user(): owners (system_owners) > invited role > domain fallback
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
  -- Extract domain and a friendly name
  v_domain := lower(split_part(new.email, '@', 2));
  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  -- 1) If the email is a system owner, ensure role='owner' and do NOT set organization_id
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

  -- 2) Check explicit invites first (takes precedence over domain matching)
  select organization_id, role into v_invited_org, v_invited_role
  from public.organization_invited_admins
  where lower(email) = lower(new.email)
  limit 1;

  if v_invited_org is not null then
    v_org_id := v_invited_org;
  else
    -- 3) Fallback: resolve org by domain (organization_domains first, then organizations.domain)
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

  -- 4) Upsert profile with role priority: invited role > default member
  insert into public.profiles (id, email, name, role, status, organization_id)
  values (new.id, new.email, v_name, coalesce(v_invited_role, 'member'), 'active', v_org_id)
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(excluded.name, public.profiles.name),
        role = coalesce(v_invited_role, public.profiles.role),
        organization_id = coalesce(excluded.organization_id, public.profiles.organization_id);

  -- 5) Consume the invite so it cannot be reused
  if v_invited_org is not null then
    delete from public.organization_invited_admins
    where organization_id = v_invited_org and lower(email) = lower(new.email);
  end if;

  return new;
end;
$$;

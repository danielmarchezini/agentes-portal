-- Auto-assign organization_id on new auth user based on email domain
-- and ensure the profile row exists.

-- Helper policy to allow a user to create/update their own profile row
-- (needed because trigger runs in auth context; keep it restrictive)
drop policy if exists "create own profile" on public.profiles;
create policy "create own profile"
  on public.profiles
  for insert
  with check (id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Function: handle new auth user
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

  -- Upsert profile
  insert into public.profiles (id, email, name, role, status, organization_id)
  values (new.id, new.email, v_name, 'member', 'active', v_org_id)
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(excluded.name, public.profiles.name),
        organization_id = coalesce(excluded.organization_id, public.profiles.organization_id);

  return new;
end;
$$;

-- Trigger on auth.users to create/update profile
-- Drops and recreates to be idempotent
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

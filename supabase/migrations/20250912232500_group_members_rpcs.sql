-- RPCs para gestão escalável de usuários e membros de grupos
-- Inclui busca paginada e operações em massa baseadas em filtro

create or replace function public.search_org_users(
  p_org uuid,
  p_q text,
  p_limit int,
  p_offset int
)
returns table(id uuid, name text, email text, role text)
language sql
security definer
set search_path = public
as $$
  with base as (
    select id, name, email, role
    from public.profiles
    where organization_id = p_org
      and (
        coalesce(p_q, '') = ''
        or name ilike '%' || p_q || '%'
        or email ilike '%' || p_q || '%'
      )
    order by name nulls last, email nulls last
    limit greatest(p_limit, 0)
    offset greatest(p_offset, 0)
  )
  select * from base;
$$;

revoke all on function public.search_org_users(uuid, text, int, int) from public;
grant execute on function public.search_org_users(uuid, text, int, int) to authenticated;

create or replace function public.count_org_users(
  p_org uuid,
  p_q text
) returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.profiles
  where organization_id = p_org
    and (
      coalesce(p_q, '') = ''
      or name ilike '%' || p_q || '%'
      or email ilike '%' || p_q || '%'
    );
$$;

revoke all on function public.count_org_users(uuid, text) from public;
grant execute on function public.count_org_users(uuid, text) to authenticated;

-- Helper para verificar se o usuário atual pode gerenciar um grupo específico
create or replace function public.can_manage_group(p_group uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_system_owner()
    or exists (
      select 1
      from public.user_groups g
      join public.profiles p on p.organization_id = g.organization_id and p.id = auth.uid()
      where g.id = p_group
    );
$$;

-- Adiciona membros por lista de IDs
create or replace function public.add_group_members(
  p_group uuid,
  p_user_ids uuid[]
) returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_group(p_group) then
    raise exception 'not authorized';
  end if;
  insert into public.group_members (group_id, user_id)
  select p_group, u
  from unnest(p_user_ids) as u
  on conflict (group_id, user_id) do nothing;
  return (select count(*) from public.group_members where group_id = p_group and user_id = any(p_user_ids));
end;
$$;

revoke all on function public.add_group_members(uuid, uuid[]) from public;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;

-- Remove membros por lista de IDs
create or replace function public.remove_group_members(
  p_group uuid,
  p_user_ids uuid[]
) returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_group(p_group) then
    raise exception 'not authorized';
  end if;
  delete from public.group_members gm
  where gm.group_id = p_group and gm.user_id = any(p_user_ids);
  return found::int;
end;
$$;

revoke all on function public.remove_group_members(uuid, uuid[]) from public;
grant execute on function public.remove_group_members(uuid, uuid[]) to authenticated;

-- Adiciona todos os usuários por filtro (sem trafegar IDs)
create or replace function public.add_group_members_by_filter(
  p_org uuid,
  p_group uuid,
  p_q text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  if not public.can_manage_group(p_group) then
    raise exception 'not authorized';
  end if;
  insert into public.group_members (group_id, user_id)
  select p_group, pr.id
  from public.profiles pr
  join public.user_groups g on g.id = p_group and g.organization_id = p_org
  where pr.organization_id = p_org
    and (
      coalesce(p_q, '') = ''
      or pr.name ilike '%' || p_q || '%'
      or pr.email ilike '%' || p_q || '%'
    )
  on conflict (group_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.add_group_members_by_filter(uuid, uuid, text) from public;
grant execute on function public.add_group_members_by_filter(uuid, uuid, text) to authenticated;

-- Remove todos os usuários por filtro
create or replace function public.remove_group_members_by_filter(
  p_org uuid,
  p_group uuid,
  p_q text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  if not public.can_manage_group(p_group) then
    raise exception 'not authorized';
  end if;
  delete from public.group_members gm
  using public.profiles pr, public.user_groups g
  where gm.group_id = p_group
    and pr.id = gm.user_id
    and g.id = p_group and g.organization_id = p_org
    and pr.organization_id = p_org
    and (
      coalesce(p_q, '') = ''
      or pr.name ilike '%' || p_q || '%'
      or pr.email ilike '%' || p_q || '%'
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.remove_group_members_by_filter(uuid, uuid, text) from public;
grant execute on function public.remove_group_members_by_filter(uuid, uuid, text) to authenticated;

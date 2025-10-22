-- RPCs para gerenciar papel e remoção de membros com validações de segurança

-- set_group_member_role: altera o papel de um membro ('member'|'admin') com regras:
-- - Autorização: system owner OR (owner/admin da organização) OR admin do grupo
-- - Admin não pode rebaixar outro admin (apenas owner pode)
-- - Não permite rebaixar o último admin do grupo
create or replace function public.set_group_member_role(
  p_group uuid,
  p_user uuid,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_actor uuid := auth.uid();
  v_actor_org_role text;
  v_target_current_role text;
  v_admin_count integer;
begin
  if p_role not in ('member','admin') then
    raise exception 'invalid role: %', p_role;
  end if;

  select organization_id into v_org from public.user_groups where id = p_group;
  if v_org is null then
    raise exception 'group not found';
  end if;

  select role into v_actor_org_role from public.profiles where id = v_actor;

  -- autorização básica: system owner, owner/admin da org ou admin do grupo
  if not (
    public.is_system_owner() OR
    (exists (select 1 from public.profiles where id = v_actor and organization_id = v_org and role in ('owner','admin'))) OR
    (exists (select 1 from public.group_members where group_id = p_group and user_id = v_actor and role = 'admin'))
  ) then
    raise exception 'not authorized';
  end if;

  -- papel atual do alvo
  select role into v_target_current_role from public.group_members where group_id = p_group and user_id = p_user;
  if v_target_current_role is null then
    raise exception 'target user is not a member of the group';
  end if;

  -- somente owner pode rebaixar admin
  if v_target_current_role = 'admin' and p_role = 'member' then
    if v_actor_org_role <> 'owner' and not public.is_system_owner() then
      raise exception 'only owner can demote an admin';
    end if;
  end if;

  -- impedir rebaixar o último admin
  if v_target_current_role = 'admin' and p_role = 'member' then
    select count(*) into v_admin_count from public.group_members where group_id = p_group and role = 'admin' and user_id <> p_user;
    if coalesce(v_admin_count,0) = 0 then
      raise exception 'cannot demote the last admin of the group';
    end if;
  end if;

  update public.group_members set role = p_role where group_id = p_group and user_id = p_user;
  return true;
end;
$$;

revoke all on function public.set_group_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_group_member_role(uuid, uuid, text) to authenticated;

-- remove_group_member: remove um membro com regras:
-- - Autorização: system owner OR (owner/admin da organização) OR admin do grupo
-- - Admin não pode remover outro admin (apenas owner pode)
-- - Não permite remover o último admin do grupo
create or replace function public.remove_group_member(
  p_group uuid,
  p_user uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_actor uuid := auth.uid();
  v_actor_org_role text;
  v_target_current_role text;
  v_admin_count integer;
begin
  select organization_id into v_org from public.user_groups where id = p_group;
  if v_org is null then
    raise exception 'group not found';
  end if;

  select role into v_actor_org_role from public.profiles where id = v_actor;

  if not (
    public.is_system_owner() OR
    (exists (select 1 from public.profiles where id = v_actor and organization_id = v_org and role in ('owner','admin'))) OR
    (exists (select 1 from public.group_members where group_id = p_group and user_id = v_actor and role = 'admin'))
  ) then
    raise exception 'not authorized';
  end if;

  select role into v_target_current_role from public.group_members where group_id = p_group and user_id = p_user;
  if v_target_current_role is null then
    -- já não é membro: considerar sucesso idempotente
    return true;
  end if;

  -- admin não pode remover outro admin
  if v_target_current_role = 'admin' then
    if v_actor_org_role <> 'owner' and not public.is_system_owner() then
      raise exception 'only owner can remove an admin';
    end if;
    select count(*) into v_admin_count from public.group_members where group_id = p_group and role = 'admin' and user_id <> p_user;
    if coalesce(v_admin_count,0) = 0 then
      raise exception 'cannot remove the last admin of the group';
    end if;
  end if;

  delete from public.group_members where group_id = p_group and user_id = p_user;
  return true;
end;
$$;

revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

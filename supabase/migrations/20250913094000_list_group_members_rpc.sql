-- RPC para listar membros de um grupo com segurança (evita 400 do endpoint REST)
-- Faz checagem de organização via join em user_groups

create or replace function public.list_group_members(
  p_group uuid
)
returns table (
  user_id uuid,
  group_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select gm.user_id, gm.group_id, gm.created_at
  from public.group_members gm
  join public.user_groups ug on ug.id = gm.group_id
  where gm.group_id = p_group
    and (
      public.is_system_owner() or
      ug.organization_id is not distinct from (
        select p.organization_id from public.profiles p where p.id = auth.uid() limit 1
      )
    )
  order by gm.created_at desc;
$$;

revoke all on function public.list_group_members(uuid) from public, anon;
grant execute on function public.list_group_members(uuid) to authenticated;

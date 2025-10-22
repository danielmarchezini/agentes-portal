-- Drop and recreate list_group_members to change return type (include role)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'list_group_members' AND pg_get_function_identity_arguments(p.oid) = 'p_group uuid'
  ) THEN
    EXECUTE 'DROP FUNCTION public.list_group_members(uuid)';
  END IF;
END $$;

create or replace function public.list_group_members(
  p_group uuid
)
returns table (
  user_id uuid,
  group_id uuid,
  role text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select gm.user_id, gm.group_id, gm.role, gm.created_at
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

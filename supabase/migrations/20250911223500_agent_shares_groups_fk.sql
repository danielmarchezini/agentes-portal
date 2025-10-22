-- Link agent_shares to groups and include groups in effective permission

-- Add FK if not exists (Postgres não suporta IF NOT EXISTS para constraints)
do $$
begin
  alter table public.agent_shares
    add constraint agent_shares_target_group_fk
    foreign key (target_group_id) references public.groups(id) on delete cascade;
exception
  when duplicate_object then
    null;
end $$;

-- Replace function to include group membership resolution
create or replace function public.agent_effective_permission(
  p_org uuid,
  p_agent uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with user_groups as (
    select gm.group_id
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where g.organization_id = p_org and gm.user_id = auth.uid()
  ), perms as (
    -- direct user share
    select case permission when 'admin' then 3 when 'edit' then 2 when 'view' then 1 else 0 end as rank
    from public.agent_shares s
    where s.organization_id = p_org
      and s.agent_id = p_agent
      and s.target_type = 'user'
      and s.target_user_id = auth.uid()
    union all
    -- public share
    select case permission when 'admin' then 3 when 'edit' then 2 when 'view' then 1 else 0 end as rank
    from public.agent_shares s
    where s.organization_id = p_org
      and s.agent_id = p_agent
      and s.target_type = 'public'
    union all
    -- group shares
    select case s.permission when 'admin' then 3 when 'edit' then 2 when 'view' then 1 else 0 end as rank
    from public.agent_shares s
    where s.organization_id = p_org
      and s.agent_id = p_agent
      and s.target_type = 'group'
      and s.target_group_id in (select group_id from user_groups)
  )
  select case coalesce(max(rank), 0)
           when 3 then 'admin'
           when 2 then 'edit'
           when 1 then 'view'
           else 'none'
         end as effective_permission
  from perms;
$$;

revoke all on function public.agent_effective_permission(uuid, uuid) from public, anon;
grant execute on function public.agent_effective_permission(uuid, uuid) to authenticated;

-- Agent shares: public/user/group with permission levels
create table if not exists public.agent_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  target_type text not null check (target_type in ('public','user','group')),
  target_user_id uuid null references public.profiles(id) on delete cascade,
  target_group_id uuid null,
  permission text not null check (permission in ('view','edit','admin')),
  message text null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists agent_shares_org_idx on public.agent_shares(organization_id);
create index if not exists agent_shares_agent_idx on public.agent_shares(agent_id);
create index if not exists agent_shares_target_user_idx on public.agent_shares(target_user_id);
create index if not exists agent_shares_target_group_idx on public.agent_shares(target_group_id);
create index if not exists agent_shares_public_idx on public.agent_shares(organization_id, agent_id) where target_type = 'public';

-- RLS
alter table public.agent_shares enable row level security;

-- Select: any org member can read shares of their org
create policy agent_shares_select on public.agent_shares
for select
using (public.is_org_member(organization_id));

-- Insert: org members can create, must be the creator
create policy agent_shares_insert on public.agent_shares
for insert to authenticated
with check (
  public.is_org_member(organization_id) and created_by = auth.uid()
);

-- Update: only creator can update (later we can extend to admin/owner if desired)
create policy agent_shares_update on public.agent_shares
for update to authenticated
using (public.is_org_member(organization_id) and created_by = auth.uid())
with check (public.is_org_member(organization_id) and created_by = auth.uid());

-- Delete: only creator
create policy agent_shares_delete on public.agent_shares
for delete to authenticated
using (public.is_org_member(organization_id) and created_by = auth.uid());

-- Helper function: resolve effective permission for the current user, considering public and direct user shares
-- NOTE: group-based resolution will be added when we wire group membership table
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
  with perms as (
    -- direct user share
    select case permission
             when 'admin' then 3 when 'edit' then 2 when 'view' then 1 else 0 end as rank
    from public.agent_shares s
    where s.organization_id = p_org
      and s.agent_id = p_agent
      and s.target_type = 'user'
      and s.target_user_id = auth.uid()
    union all
    -- public share
    select case permission
             when 'admin' then 3 when 'edit' then 2 when 'view' then 1 else 0 end as rank
    from public.agent_shares s
    where s.organization_id = p_org
      and s.agent_id = p_agent
      and s.target_type = 'public'
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

-- Groups and group_members for sharing and permissions
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','manager')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Indexes
create index if not exists groups_org_idx on public.groups(organization_id);
create index if not exists group_members_user_idx on public.group_members(user_id);

-- RLS
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Policies: org members can read groups of their org
create policy groups_select on public.groups
for select
using (public.is_org_member(organization_id));

-- Only org members can create groups; creator must match auth.uid()
create policy groups_insert on public.groups
for insert to authenticated
with check (public.is_org_member(organization_id) and created_by = auth.uid());

-- Update/delete: creator can manage; can be extended to admins later
create policy groups_update on public.groups
for update to authenticated
using (public.is_org_member(organization_id) and created_by = auth.uid())
with check (public.is_org_member(organization_id) and created_by = auth.uid());

create policy groups_delete on public.groups
for delete to authenticated
using (public.is_org_member(organization_id) and created_by = auth.uid());

-- group_members policies
create policy group_members_select on public.group_members
for select using (
  exists (
    select 1 from public.groups g
    where g.id = group_id and public.is_org_member(g.organization_id)
  )
);

create policy group_members_insert on public.group_members
for insert to authenticated
with check (
  exists (
    select 1 from public.groups g
    where g.id = group_id and public.is_org_member(g.organization_id)
  ) and created_by = auth.uid()
);

create policy group_members_update on public.group_members
for update to authenticated
using (
  exists (
    select 1 from public.groups g
    where g.id = group_id and public.is_org_member(g.organization_id)
  ) and created_by = auth.uid()
)
with check (
  exists (
    select 1 from public.groups g
    where g.id = group_id and public.is_org_member(g.organization_id)
  ) and created_by = auth.uid()
);

create policy group_members_delete on public.group_members
for delete to authenticated
using (
  exists (
    select 1 from public.groups g
    where g.id = group_id and public.is_org_member(g.organization_id)
  ) and created_by = auth.uid()
);

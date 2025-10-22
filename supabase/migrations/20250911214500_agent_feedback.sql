-- Table to store per-user like feedback for agents
create table if not exists public.agent_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  liked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure single feedback per (agent,user)
create unique index if not exists agent_feedback_unique on public.agent_feedback(agent_id, user_id);
create index if not exists agent_feedback_org_idx on public.agent_feedback(organization_id);
create index if not exists agent_feedback_agent_idx on public.agent_feedback(agent_id);
create index if not exists agent_feedback_user_idx on public.agent_feedback(user_id);

-- Trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger agent_feedback_set_updated_at
before update on public.agent_feedback
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.agent_feedback enable row level security;

-- Policies: org members can read org feedback; users can upsert their own feedback within org
create policy agent_feedback_select on public.agent_feedback
for select
using (
  public.is_org_member(organization_id)
);

create policy agent_feedback_insert on public.agent_feedback
for insert to authenticated
with check (
  public.is_org_member(organization_id) and user_id = auth.uid()
);

create policy agent_feedback_update on public.agent_feedback
for update to authenticated
using (
  public.is_org_member(organization_id) and user_id = auth.uid()
)
with check (
  public.is_org_member(organization_id) and user_id = auth.uid()
);

-- Stats RPC: returns likes_count, total_count and ratio for filters
create or replace function public.agent_feedback_stats(
  p_org uuid,
  p_from date default null,
  p_to date default null,
  p_agent uuid default null
)
returns table (
  likes_count bigint,
  total_count bigint,
  ratio numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where liked) as likes_count,
    count(*) as total_count,
    case when count(*) = 0 then 0 else (count(*) filter (where liked))::numeric / count(*) end as ratio
  from public.agent_feedback f
  where f.organization_id = p_org
    and (p_agent is null or f.agent_id = p_agent)
    and (p_from is null or f.created_at >= (p_from::timestamptz))
    and (p_to is null or f.created_at < ((p_to + 1)::timestamptz));
$$;

revoke all on function public.agent_feedback_stats(uuid, date, date, uuid) from public, anon;
grant execute on function public.agent_feedback_stats(uuid, date, date, uuid) to authenticated;

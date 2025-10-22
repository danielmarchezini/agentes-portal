-- Conversation outcomes: track resolved status per conversation to compute resolution rate
create extension if not exists "pgcrypto";

create table if not exists public.conversation_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  conversation_id text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists conversation_outcomes_org_created_idx on public.conversation_outcomes(organization_id, created_at desc);
create index if not exists conversation_outcomes_agent_idx on public.conversation_outcomes(agent_id);
create index if not exists conversation_outcomes_conv_idx on public.conversation_outcomes(conversation_id);
-- Ensure one outcome per conversation per organization (supports ON CONFLICT upsert)
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'conversation_outcomes_org_conv_uidx'
  ) then
    execute 'create unique index conversation_outcomes_org_conv_uidx on public.conversation_outcomes(organization_id, conversation_id)';
  end if;
end $$;

alter table public.conversation_outcomes enable row level security;

-- Read: org members can read outcomes of their org
drop policy if exists conversation_outcomes_select on public.conversation_outcomes;
create policy conversation_outcomes_select on public.conversation_outcomes
for select to authenticated
using (
  public.is_org_member(organization_id)
);

-- Insert: org members can log outcomes for their org
drop policy if exists conversation_outcomes_insert on public.conversation_outcomes;
create policy conversation_outcomes_insert on public.conversation_outcomes
for insert to authenticated
with check (
  public.is_org_member(organization_id)
);

-- Update: org members can update outcomes of their org
drop policy if exists conversation_outcomes_update on public.conversation_outcomes;
create policy conversation_outcomes_update on public.conversation_outcomes
for update to authenticated
using (
  public.is_org_member(organization_id)
)
with check (
  public.is_org_member(organization_id)
);

-- Optional helper: upsert outcome
create or replace function public.upsert_conversation_outcome(
  p_org uuid,
  p_agent uuid,
  p_conversation_id text,
  p_resolved boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.conversation_outcomes(organization_id, agent_id, conversation_id, resolved)
  values (p_org, p_agent, p_conversation_id, p_resolved)
  on conflict (organization_id, conversation_id)
  do update set resolved = excluded.resolved,
                agent_id = excluded.agent_id;
end; $$;

revoke all on function public.upsert_conversation_outcome(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.upsert_conversation_outcome(uuid, uuid, text, boolean) to authenticated;

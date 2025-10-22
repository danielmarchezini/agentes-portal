-- Add per-agent memory settings and persistent user summary + cost_estimated flag
alter table if exists public.agents
  add column if not exists history_token_limit integer,
  add column if not exists enable_summarization boolean default false,
  add column if not exists summarization_token_threshold integer,
  add column if not exists summarization_max_chars integer;

-- Persistent memory per (agent,user)
create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary_text text,
  updated_at timestamptz not null default now(),
  unique (agent_id, user_id)
);

alter table if exists public.agent_memory enable row level security;

DO $$
BEGIN
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='agent_memory' and policyname='agent_memory_select')
  THEN execute 'drop policy agent_memory_select on public.agent_memory'; END IF;
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='agent_memory' and policyname='agent_memory_upsert')
  THEN execute 'drop policy agent_memory_upsert on public.agent_memory'; END IF;
END $$;

create policy agent_memory_select on public.agent_memory
for select using (user_id = auth.uid());

create policy agent_memory_upsert on public.agent_memory
for all using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Mark estimated costs
alter table if exists public.agent_token_usage
  add column if not exists cost_estimated boolean not null default false;

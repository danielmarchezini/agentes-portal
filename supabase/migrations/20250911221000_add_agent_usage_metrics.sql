-- Agent usage metrics: tracks generation latency, output size, and token/cost when available
-- ensure pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

create table if not exists public.agent_usage_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  agent_id uuid references public.agents(id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic','google','perplexity','ollama')),
  model text not null,
  duration_ms integer,
  output_chars integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  cost_usd numeric(12,6),
  created_at timestamptz not null default now()
);

alter table public.agent_usage_metrics enable row level security;

-- RLS: org members can insert and read metrics of their org's agents
drop policy if exists "org members read metrics" on public.agent_usage_metrics;
create policy "org members read metrics" on public.agent_usage_metrics
  for select to authenticated using (
    exists (
      select 1 from public.agents a
      where a.id = agent_usage_metrics.agent_id
        and a.organization_id = (select organization_id from public.profiles p where p.id = auth.uid())
    )
  );

drop policy if exists "org members insert metrics" on public.agent_usage_metrics;
create policy "org members insert metrics" on public.agent_usage_metrics
  for insert to authenticated with check (
    exists (
      select 1 from public.agents a
      where a.id = agent_usage_metrics.agent_id
        and a.organization_id = (select organization_id from public.profiles p where p.id = auth.uid())
    )
  );

create index if not exists agent_usage_metrics_agent_created_idx on public.agent_usage_metrics(agent_id, created_at desc);

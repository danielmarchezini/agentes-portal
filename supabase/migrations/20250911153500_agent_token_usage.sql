-- Track tokens and cost per interaction
create table if not exists public.agent_token_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete cascade,
  provider text not null,
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  cost_usd numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists agent_token_usage_org_idx on public.agent_token_usage(organization_id);
create index if not exists agent_token_usage_agent_idx on public.agent_token_usage(agent_id);
create index if not exists agent_token_usage_created_idx on public.agent_token_usage(created_at);

-- Message history and retention

-- Agent messages table
create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_agent_id_idx on public.agent_messages(agent_id);
create index if not exists agent_messages_created_at_idx on public.agent_messages(created_at);

-- Retention limit per agent (max number of messages kept in history)
alter table if exists public.agents
  add column if not exists retention_limit integer check (retention_limit > 0);

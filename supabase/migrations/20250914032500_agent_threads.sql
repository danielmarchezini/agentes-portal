-- Assistants v2: persist thread per (agent_id, user_id)
create table if not exists public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, user_id)
);

create index if not exists agent_threads_agent_idx on public.agent_threads(agent_id);
create index if not exists agent_threads_user_idx on public.agent_threads(user_id);

-- RLS
alter table if exists public.agent_threads enable row level security;

-- Drop old policies if exist
DO $$
BEGIN
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='agent_threads' and policyname='agent_threads_select')
  THEN execute 'drop policy agent_threads_select on public.agent_threads'; END IF;
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='agent_threads' and policyname='agent_threads_upsert')
  THEN execute 'drop policy agent_threads_upsert on public.agent_threads'; END IF;
END $$;

-- Users can read their own thread records
create policy agent_threads_select on public.agent_threads
for select using (
  user_id = auth.uid()
);

-- Users can insert/update their own thread records
create policy agent_threads_upsert on public.agent_threads
for all using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Add vector_store_id column to agents to reuse OpenAI vector stores per agent
alter table if exists public.agents
  add column if not exists vector_store_id text;

create index if not exists agents_vector_store_idx on public.agents(vector_store_id);

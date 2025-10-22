-- Add assistant-related columns to agents table
alter table if exists public.agents
  add column if not exists mode text check (mode in ('custom','assistant')) default 'custom',
  add column if not exists assistant_provider text,
  add column if not exists assistant_id text;

-- Helpful index if filtering by provider/id
create index if not exists agents_assistant_provider_idx on public.agents(assistant_provider);
create index if not exists agents_mode_idx on public.agents(mode);

-- Agent security policies and additional instructions
alter table if exists public.agents
  add column if not exists additional_instructions text,
  add column if not exists strict_mode boolean default true,
  add column if not exists blocked_terms text[];

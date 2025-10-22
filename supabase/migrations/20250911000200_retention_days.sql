-- Message retention by days per agent
alter table if exists public.agents
  add column if not exists retention_days integer check (retention_days >= 0);

-- Optional helper index if querying agents by retention_days
create index if not exists agents_retention_days_idx on public.agents(retention_days);

-- Enable RLS and add policies for public.agent_token_usage
-- Allows org-scoped selects/inserts for authenticated users; service role bypasses RLS by default

alter table if exists public.agent_token_usage enable row level security;

-- Drop existing policies if any (idempotent)
DO $$
BEGIN
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='agent_token_usage' and policyname='agent_token_usage_select')
  THEN execute 'drop policy agent_token_usage_select on public.agent_token_usage'; END IF;
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='agent_token_usage' and policyname='agent_token_usage_insert')
  THEN execute 'drop policy agent_token_usage_insert on public.agent_token_usage'; END IF;
END $$;

-- SELECT: same organization or system owner
create policy agent_token_usage_select on public.agent_token_usage
for select using (
  organization_id is not distinct from (
    select p.organization_id from public.profiles p where p.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- INSERT: same organization or system owner
create policy agent_token_usage_insert on public.agent_token_usage
for insert with check (
  organization_id is not distinct from (
    select p.organization_id from public.profiles p where p.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- Org settings for executive KPIs
create extension if not exists "pgcrypto";

create table if not exists public.org_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope text not null check (scope in ('org','category','agent')),
  category text null,
  agent_id uuid null references public.agents(id) on delete cascade,
  revenue_per_interaction numeric(12,4) null,
  conversion_rate numeric(6,5) null,
  minutes_saved_per_interaction numeric(8,3) null,
  hourly_cost numeric(12,4) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_settings_org_idx on public.org_settings(organization_id);
create index if not exists org_settings_scope_idx on public.org_settings(scope);

-- unique key across scopes (org/category/agent)
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='org_settings_unique_scope_idx'
  ) then
    execute 'create unique index org_settings_unique_scope_idx on public.org_settings(
      organization_id, scope, coalesce(category, ''*''), coalesce(agent_id, ''00000000-0000-0000-0000-000000000000'')
    )';
  end if;
end $$;

alter table public.org_settings enable row level security;

-- Policies: org members can read and write their org
drop policy if exists org_settings_select on public.org_settings;
create policy org_settings_select on public.org_settings
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists org_settings_insert on public.org_settings;
create policy org_settings_insert on public.org_settings
for insert to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists org_settings_update on public.org_settings;
create policy org_settings_update on public.org_settings
for update to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- Helper: get effective settings with precedence agent > category > org
create or replace function public.get_effective_org_settings(
  p_org uuid,
  p_agent uuid,
  p_category text
) returns table (
  revenue_per_interaction numeric,
  conversion_rate numeric,
  minutes_saved_per_interaction numeric,
  hourly_cost numeric
) language sql stable security definer set search_path=public as $$
  with all_opts as (
    select 3 as prio, revenue_per_interaction, conversion_rate, minutes_saved_per_interaction, hourly_cost
    from public.org_settings s
    where s.organization_id = p_org and s.scope='agent' and s.agent_id = p_agent
    union all
    select 2 as prio, revenue_per_interaction, conversion_rate, minutes_saved_per_interaction, hourly_cost
    from public.org_settings s
    where s.organization_id = p_org and s.scope='category' and s.category = p_category
    union all
    select 1 as prio, revenue_per_interaction, conversion_rate, minutes_saved_per_interaction, hourly_cost
    from public.org_settings s
    where s.organization_id = p_org and s.scope='org'
  ), merged as (
    select 
      (select revenue_per_interaction from all_opts where revenue_per_interaction is not null order by prio desc limit 1) as revenue_per_interaction,
      (select conversion_rate from all_opts where conversion_rate is not null order by prio desc limit 1) as conversion_rate,
      (select minutes_saved_per_interaction from all_opts where minutes_saved_per_interaction is not null order by prio desc limit 1) as minutes_saved_per_interaction,
      (select hourly_cost from all_opts where hourly_cost is not null order by prio desc limit 1) as hourly_cost
  )
  select * from merged;
$$;

revoke all on function public.get_effective_org_settings(uuid, uuid, text) from public, anon;
grant execute on function public.get_effective_org_settings(uuid, uuid, text) to authenticated;

-- Upsert settings
create or replace function public.upsert_org_settings(
  p_org uuid,
  p_scope text,
  p_category text,
  p_agent uuid,
  p_revenue numeric,
  p_conv numeric,
  p_minutes numeric,
  p_hourly numeric
) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.org_settings(organization_id, scope, category, agent_id, revenue_per_interaction, conversion_rate, minutes_saved_per_interaction, hourly_cost)
  values(p_org, p_scope, p_category, p_agent, p_revenue, p_conv, p_minutes, p_hourly)
  on conflict (organization_id, scope, coalesce(category, '*'), coalesce(agent_id, '00000000-0000-0000-0000-000000000000'))
  do update set revenue_per_interaction = excluded.revenue_per_interaction,
                conversion_rate = excluded.conversion_rate,
                minutes_saved_per_interaction = excluded.minutes_saved_per_interaction,
                hourly_cost = excluded.hourly_cost,
                updated_at = now();
end; $$;

revoke all on function public.upsert_org_settings(uuid, text, text, uuid, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.upsert_org_settings(uuid, text, text, uuid, numeric, numeric, numeric, numeric) to authenticated;

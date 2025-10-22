-- Create organization_domains table and update RPC for domain checks

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

create table if not exists public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null,
  created_at timestamptz default now()
);

create unique index if not exists organization_domains_org_domain_idx
  on public.organization_domains(organization_id, lower(domain));

alter table public.organization_domains enable row level security;

-- Helper: system admin check (based on profiles.email)
create or replace function public.is_system_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.email = 'dmarchezini@gmail.com'
  );
$$;

grant execute on function public.is_system_admin() to anon, authenticated, service_role;

-- RLS policies for organization_domains
-- Members of an org can read their org domains; system admin has full access
drop policy if exists "org members can read their domains" on public.organization_domains;
create policy "org members can read their domains" on public.organization_domains
  for select using (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "system admin full access to org domains" on public.organization_domains;
create policy "system admin full access to org domains" on public.organization_domains
  for all using (public.is_system_admin()) with check (public.is_system_admin());

-- Broaden organizations policies for system admin full access
drop policy if exists "system admin full access to organizations" on public.organizations;
create policy "system admin full access to organizations" on public.organizations
  for all using (public.is_system_admin()) with check (public.is_system_admin());

-- Update RPC to use organization_domains first, fallback to organizations.domain
create or replace function public.is_domain_allowed(p_domain text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with d as (
    select lower(p_domain) as dom
  )
  select exists (
    -- Check additional domains table
    select 1 from public.organization_domains od, d
    where lower(od.domain) = d.dom
       or d.dom like ('%.' || lower(od.domain))
  )
  or exists (
    -- Fallback to organizations.domain
    select 1 from public.organizations o, d
    where lower(o.domain) = d.dom
       or d.dom like ('%.' || lower(o.domain))
  );
$$;

grant execute on function public.is_domain_allowed(text) to anon, authenticated, service_role;

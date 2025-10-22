-- Secure-ish storage for LLM API keys per organization
-- Note: relies on RLS; owners/admins can manage. Keys are stored in DB; consider pgcrypto or Edge Functions for production-hardening.

create table if not exists public.org_llm_secrets (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic','google','perplexity','ollama')),
  api_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, provider)
);

alter table public.org_llm_secrets enable row level security;

-- Helper: is org admin/owner for a given organization
create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('admin','owner')
        or public.is_system_admin()
      )
      and (p.organization_id = p_org or public.is_system_admin())
  );
$$;

grant execute on function public.is_org_admin(uuid) to authenticated, service_role;

-- RLS policies
drop policy if exists "org admins manage llm secrets" on public.org_llm_secrets;
create policy "org admins manage llm secrets" on public.org_llm_secrets
  for all
  to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- RPC: set_llm_secret (upsert)
create or replace function public.set_llm_secret(p_org uuid, p_provider text, p_api_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org) then
    raise exception 'not authorized';
  end if;
  insert into public.org_llm_secrets(organization_id, provider, api_key)
  values (p_org, lower(p_provider), p_api_key)
  on conflict (organization_id, provider)
  do update set api_key = excluded.api_key, updated_at = now();
end;
$$;

grant execute on function public.set_llm_secret(uuid, text, text) to authenticated, service_role;

-- RPC: get_llm_secrets_masked (does not expose full keys)
create or replace function public.get_llm_secrets_masked(p_org uuid)
returns table(provider text, has_key boolean, preview text)
language sql
security definer
set search_path = public
as $$
  select s.provider,
         true as has_key,
         case when length(s.api_key) > 8 then concat(left(s.api_key, 4), '****', right(s.api_key, 4)) else '****' end as preview
  from public.org_llm_secrets s
  where s.organization_id = p_org and public.is_org_admin(p_org);
$$;

grant execute on function public.get_llm_secrets_masked(uuid) to authenticated, service_role;

-- Helper: is org member for a given organization
create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.organization_id = p_org
  );
$$;

grant execute on function public.is_org_member(uuid) to authenticated, service_role;

-- RPC: get_llm_secret (returns full key) - restricted to org members
create or replace function public.get_llm_secret(p_org uuid, p_provider text)
returns text
language sql
security definer
set search_path = public
as $$
  select case when public.is_org_member(p_org)
              then (select api_key from public.org_llm_secrets where organization_id = p_org and provider = lower(p_provider))
              else null end;
$$;

grant execute on function public.get_llm_secret(uuid, text) to authenticated, service_role;

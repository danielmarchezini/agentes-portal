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
-- This replaces the previous version that was restricted to admins/owners
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

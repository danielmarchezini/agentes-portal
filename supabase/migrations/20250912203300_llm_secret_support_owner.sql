-- Allow system owners to fetch org LLM secrets for support/debug sessions
-- Updates get_llm_secret to return the key when the current user is an org member OR a system owner

create or replace function public.get_llm_secret(p_org uuid, p_provider text)
returns text
language sql
security definer
set search_path = public
as $$
  select case when public.is_org_member(p_org) or public.is_system_owner()
              then (select api_key from public.org_llm_secrets where organization_id = p_org and provider = lower(p_provider))
              else null end;
$$;

grant execute on function public.get_llm_secret(uuid, text) to authenticated, service_role;

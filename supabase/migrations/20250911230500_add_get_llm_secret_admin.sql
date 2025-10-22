-- Server-side RPC to fetch LLM secret ignoring end-user membership (used only by Edge Functions)
create or replace function public.get_llm_secret_admin(p_org uuid, p_provider text)
returns text
language sql
security definer
set search_path = public
as $$
  select api_key
  from public.org_llm_secrets
  where organization_id = p_org and provider = lower(p_provider);
$$;

-- Restrict execution to service_role only
revoke all on function public.get_llm_secret_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.get_llm_secret_admin(uuid, text) to service_role;

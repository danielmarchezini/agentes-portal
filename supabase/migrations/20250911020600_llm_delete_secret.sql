-- RPC to delete a stored LLM secret for a provider
create or replace function public.delete_llm_secret(p_org uuid, p_provider text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org) then
    raise exception 'not authorized';
  end if;
  delete from public.org_llm_secrets
  where organization_id = p_org and provider = lower(p_provider);
end;
$$;

grant execute on function public.delete_llm_secret(uuid, text) to authenticated, service_role;

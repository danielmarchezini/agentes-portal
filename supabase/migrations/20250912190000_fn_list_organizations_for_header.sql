-- RPC: lista organizações para o seletor do header, com bypass seguro de RLS via SECURITY DEFINER
-- Owners globais veem todas; demais veem apenas a sua própria organização

create or replace function public.list_organizations_for_header()
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  ) then
    return query
      select o.id, o.name
      from public.organizations o
      order by o.name asc;
  else
    return query
      select o.id, o.name
      from public.organizations o
      where o.id = (
        select p.organization_id from public.profiles p where p.id = auth.uid() limit 1
      )
      order by o.name asc;
  end if;
end;
$$;

-- Permissões de execução para usuários autenticados
grant execute on function public.list_organizations_for_header() to authenticated;

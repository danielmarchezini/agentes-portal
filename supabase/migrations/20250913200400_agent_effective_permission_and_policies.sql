-- RPC: agent_effective_permission
create or replace function public.agent_effective_permission(p_org uuid, p_agent uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_perm text := 'none';
begin
  -- papel do usuário atual na organização
  select pr.role into v_role
  from public.profiles pr
  where pr.id = auth.uid() and pr.organization_id = p_org;

  if v_role in ('owner','admin') then
    return 'admin';
  end if;

  -- se há compartilhamento público
  if exists (
    select 1 from public.agent_shares s
    where s.organization_id = p_org and s.agent_id = p_agent and s.target_type = 'public'
  ) then
    v_perm := 'view';
  end if;

  -- compartilhamento direto com o usuário
  if exists (
    select 1 from public.agent_shares s
    where s.organization_id = p_org and s.agent_id = p_agent
      and s.target_type = 'user' and s.target_user_id = auth.uid()
  ) then
    select s.permission into v_perm
    from public.agent_shares s
    where s.organization_id = p_org and s.agent_id = p_agent
      and s.target_type = 'user' and s.target_user_id = auth.uid()
    order by case s.permission when 'admin' then 3 when 'edit' then 2 when 'view' then 1 else 0 end desc
    limit 1;
  end if;

  -- compartilhamento via grupo
  begin
    if exists (
      select 1
      from public.agent_shares s
      join public.group_members gm on gm.group_id = s.target_group_id
      where s.organization_id = p_org and s.agent_id = p_agent
        and s.target_type = 'group' and gm.user_id = auth.uid()
    ) then
      select s.permission into v_perm
      from public.agent_shares s
      join public.group_members gm on gm.group_id = s.target_group_id
      where s.organization_id = p_org and s.agent_id = p_agent
        and s.target_type = 'group' and gm.user_id = auth.uid()
      order by case s.permission when 'admin' then 3 when 'edit' then 2 when 'view' then 1 else 0 end desc
      limit 1;
    end if;
  exception when undefined_table then
    -- se group_members ainda não existir em algum ambiente, ignore
    null;
  end;

  return coalesce(v_perm, 'none');
end;
$$;

revoke all on function public.agent_effective_permission(uuid, uuid) from public;
grant execute on function public.agent_effective_permission(uuid, uuid) to authenticated;

-- Política de leitura básica para agent_templates (evitar 403)
-- Ajuste conforme seu modelo de RLS; aqui liberamos SELECT para usuários autenticados
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agent_templates'
  ) THEN
    ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;
    -- policy idempotente
    drop policy if exists agent_templates_select_all on public.agent_templates;
    create policy agent_templates_select_all on public.agent_templates
    for select to authenticated
    using (true);
  END IF;
END $$;

-- Ampliar policies: permitir que Especialista em IA (bot_manager) publique/edite/remova templates
-- Usa verificação do papel no perfil da mesma organização do template

alter table if exists public.agent_templates enable row level security;

-- Helper inline para checar se o usuário atual é bot_manager da org da linha
-- (evita necessidade de criar uma função dedicada)
-- Expressão reutilizada nas policies:
--   exists (
--     select 1 from public.profiles pr
--     where pr.id = auth.uid() and pr.organization_id = agent_templates.organization_id and pr.role = 'bot_manager'
--   )

-- Recria policies idempotentes incluindo bot_manager
drop policy if exists agent_templates_insert on public.agent_templates;
create policy agent_templates_insert on public.agent_templates
for insert to authenticated
with check (
  public.is_system_owner()
  OR public.is_org_admin(organization_id)
  OR exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.organization_id = agent_templates.organization_id and pr.role = 'bot_manager'
  )
);

drop policy if exists agent_templates_update on public.agent_templates;
create policy agent_templates_update on public.agent_templates
for update to authenticated
using (
  public.is_system_owner()
  OR public.is_org_admin(organization_id)
  OR exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.organization_id = agent_templates.organization_id and pr.role = 'bot_manager'
  )
)
with check (
  public.is_system_owner()
  OR public.is_org_admin(organization_id)
  OR exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.organization_id = agent_templates.organization_id and pr.role = 'bot_manager'
  )
);

drop policy if exists agent_templates_delete on public.agent_templates;
create policy agent_templates_delete on public.agent_templates
for delete to authenticated
using (
  public.is_system_owner()
  OR public.is_org_admin(organization_id)
  OR exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.organization_id = agent_templates.organization_id and pr.role = 'bot_manager'
  )
);

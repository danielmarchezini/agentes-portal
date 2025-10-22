-- RLS e triggers para agent_templates: SELECT, INSERT, UPDATE, DELETE
-- Objetivo: permitir leitura ampla e publicação por admin/owner da organização

-- Garantir RLS ativo
alter table if exists public.agent_templates enable row level security;

-- Função helper: preencher created_by se nulo (reuso se já existir)
create or replace function public.set_created_by()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

-- Função helper: preencher organization_id a partir do perfil do usuário autenticado
create or replace function public.set_org_from_profile()
returns trigger
language plpgsql
as $$
declare
  v_org uuid;
begin
  if new.organization_id is null then
    select pr.organization_id into v_org from public.profiles pr where pr.id = auth.uid();
    new.organization_id := coalesce(new.organization_id, v_org);
  end if;
  return new;
end;
$$;

-- Triggers idempotentes em agent_templates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agent_templates' AND column_name='created_by'
  ) THEN
    drop trigger if exists trg_agent_templates_set_created_by on public.agent_templates;
    create trigger trg_agent_templates_set_created_by
    before insert on public.agent_templates
    for each row execute procedure public.set_created_by();
  END IF;
END $$;

drop trigger if exists trg_agent_templates_set_org on public.agent_templates;
create trigger trg_agent_templates_set_org
before insert on public.agent_templates
for each row execute procedure public.set_org_from_profile();

-- Policies idempotentes
-- Leitura ampla (já criada antes, mas tornamos idempotente aqui)
drop policy if exists agent_templates_select_all on public.agent_templates;
create policy agent_templates_select_all on public.agent_templates
for select to authenticated, anon
using (true);

-- Inserção por admin/owner da organização ou system owner
drop policy if exists agent_templates_insert on public.agent_templates;
create policy agent_templates_insert on public.agent_templates
for insert to authenticated
with check (
  public.is_system_owner() OR public.is_org_admin(organization_id)
);

-- Atualização por admin/owner da organização
-- USING controla quais linhas o usuário pode selecionar para update; WITH CHECK valida o novo estado
drop policy if exists agent_templates_update on public.agent_templates;
create policy agent_templates_update on public.agent_templates
for update to authenticated
using (
  public.is_system_owner() OR public.is_org_admin(organization_id)
)
with check (
  public.is_system_owner() OR public.is_org_admin(organization_id)
);

-- Remoção por admin/owner da organização
drop policy if exists agent_templates_delete on public.agent_templates;
create policy agent_templates_delete on public.agent_templates
for delete to authenticated
using (
  public.is_system_owner() OR public.is_org_admin(organization_id)
);

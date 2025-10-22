-- Corrige policies e triggers de agent_templates quando não existe coluna created_by
-- Remove referências a created_by nas policies e só cria trigger set_created_by se a coluna existir

-- Garantir RLS ativo
alter table if exists public.agent_templates enable row level security;

-- Policies idempotentes (sem created_by)
drop policy if exists agent_templates_select_all on public.agent_templates;
create policy agent_templates_select_all on public.agent_templates
for select to authenticated, anon
using (true);

-- INSERT: apenas admin/owner da org ou system owner
drop policy if exists agent_templates_insert on public.agent_templates;
create policy agent_templates_insert on public.agent_templates
for insert to authenticated
with check (
  public.is_system_owner() OR public.is_org_admin(organization_id)
);

-- UPDATE: admin/owner da org ou system owner (sem created_by)
drop policy if exists agent_templates_update on public.agent_templates;
create policy agent_templates_update on public.agent_templates
for update to authenticated
using (
  public.is_system_owner() OR public.is_org_admin(organization_id)
)
with check (
  public.is_system_owner() OR public.is_org_admin(organization_id)
);

-- DELETE: admin/owner da org ou system owner (sem created_by)
drop policy if exists agent_templates_delete on public.agent_templates;
create policy agent_templates_delete on public.agent_templates
for delete to authenticated
using (
  public.is_system_owner() OR public.is_org_admin(organization_id)
);

-- Triggers: só criar o set_created_by se a coluna existir
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

-- Trigger para organization_id continua útil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='set_org_from_profile'
  ) THEN
    create or replace function public.set_org_from_profile()
    returns trigger
    language plpgsql
    as $func$
    declare
      v_org uuid;
    begin
      if new.organization_id is null then
        select pr.organization_id into v_org from public.profiles pr where pr.id = auth.uid();
        new.organization_id := coalesce(new.organization_id, v_org);
      end if;
      return new;
    end;
    $func$;
  END IF;

  drop trigger if exists trg_agent_templates_set_org on public.agent_templates;
  create trigger trg_agent_templates_set_org
  before insert on public.agent_templates
  for each row execute procedure public.set_org_from_profile();
END $$;

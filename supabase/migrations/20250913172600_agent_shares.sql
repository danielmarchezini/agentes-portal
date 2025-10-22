-- agent_shares: compartilhamento de agentes por organização
-- Cria tabela, constraints, índices, RLS e policies

create table if not exists public.agent_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  target_type text not null check (target_type in ('public','user','group')),
  target_user_id uuid references public.profiles(id) on delete cascade,
  target_group_id uuid references public.user_groups(id) on delete cascade,
  permission text not null default 'view' check (permission in ('view','edit','admin')),
  message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  -- Coerência do alvo
  constraint agent_shares_target_coherence check (
    (target_type = 'public' and target_user_id is null and target_group_id is null)
    or (target_type = 'user' and target_user_id is not null and target_group_id is null)
    or (target_type = 'group' and target_group_id is not null and target_user_id is null)
  )
);

-- Uniqueness para evitar duplicidade
create unique index if not exists ux_agent_shares_public on public.agent_shares (agent_id)
  where target_type = 'public';
create unique index if not exists ux_agent_shares_user on public.agent_shares (agent_id, target_user_id)
  where target_type = 'user';
create unique index if not exists ux_agent_shares_group on public.agent_shares (agent_id, target_group_id)
  where target_type = 'group';

-- Índices auxiliares
create index if not exists ix_agent_shares_agent on public.agent_shares (agent_id);
create index if not exists ix_agent_shares_org on public.agent_shares (organization_id);
create index if not exists ix_agent_shares_target_user on public.agent_shares (target_user_id);
create index if not exists ix_agent_shares_target_group on public.agent_shares (target_group_id);

-- RLS
alter table public.agent_shares enable row level security;

-- Helper: verifica se o usuário atual pertence à organização informada
create or replace function public.is_member_of_org(p_org uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.organization_id = p_org
  );
$$;

-- Helper: verifica papel do usuário atual na org
create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.organization_id = p_org
      and (pr.role in ('admin','owner'))
  );
$$;

-- Helper: verifica se usuário pertence a um grupo (resiliente à ordem das migrações)
create or replace function public.is_member_of_group(p_group uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_is_member boolean := false;
begin
  begin
    select exists(
      select 1 from public.group_members gm
      where gm.group_id = p_group and gm.user_id = auth.uid()
    ) into v_is_member;
  exception when undefined_table then
    return false;
  end;
  return v_is_member;
end;
$$;

-- Policy: SELECT
-- Pode ver um compartilhamento se: é público, ou foi criado por mim, ou direcionado a mim,
-- ou sou membro do grupo alvo; e sou membro da organização do share
drop policy if exists agent_shares_select on public.agent_shares;
create policy agent_shares_select on public.agent_shares
for select
using (
  public.is_member_of_org(organization_id)
  and (
    target_type = 'public'
    or created_by = auth.uid()
    or target_user_id = auth.uid()
    or (target_group_id is not null and public.is_member_of_group(target_group_id))
  )
);

-- Policy: INSERT
-- Permite inserir apenas para admin/owner da org
drop policy if exists agent_shares_insert on public.agent_shares;
create policy agent_shares_insert on public.agent_shares
for insert
with check (
  public.is_org_admin(organization_id)
);

-- Policy: UPDATE
-- Admin/owner da org pode atualizar, e também o criador pode alterar sua própria linha
drop policy if exists agent_shares_update on public.agent_shares;
create policy agent_shares_update on public.agent_shares
for update
using (
  public.is_org_admin(organization_id) or created_by = auth.uid()
)
with check (
  public.is_org_admin(organization_id) or created_by = auth.uid()
);

-- Policy: DELETE
-- Admin/owner da org ou criador do share
drop policy if exists agent_shares_delete on public.agent_shares;
create policy agent_shares_delete on public.agent_shares
for delete
using (
  public.is_org_admin(organization_id) or created_by = auth.uid()
);

-- Trigger para preencher created_by com auth.uid() se vier nulo
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

drop trigger if exists trg_agent_shares_set_created_by on public.agent_shares;
create trigger trg_agent_shares_set_created_by
before insert on public.agent_shares
for each row execute procedure public.set_created_by();

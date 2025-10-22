-- Criação de tabelas para Agentes e vínculo com Ações Externas (n8n)
-- Mantém o mesmo padrão de RLS/policies de external_actions

-- agents: catálogo de agentes por organização
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  settings jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

comment on table public.agents is 'Catálogo de agentes (configuração de comportamento, tools e políticas)';

-- Caso a tabela já existisse com esquema diferente, garante colunas necessárias
alter table public.agents
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists enabled boolean not null default true,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_agents_org on public.agents(organization_id);
create index if not exists idx_agents_enabled on public.agents(enabled);

-- agent_actions: vínculo N:1 entre agente e external_actions
create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  external_action_id uuid not null references public.external_actions(id) on delete cascade,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(agent_id, external_action_id)
);

comment on table public.agent_actions is 'Vínculo entre agentes e ações externas (n8n)';

create index if not exists idx_agent_actions_agent on public.agent_actions(agent_id);
create index if not exists idx_agent_actions_action on public.agent_actions(external_action_id);

-- RLS
alter table public.agents enable row level security;
alter table public.agent_actions enable row level security;

-- Policies para agents: membros da org podem ler; owners/admins podem modificar
create policy agents_select on public.agents
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = agents.organization_id
    )
  );

create policy agents_modify on public.agents
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = agents.organization_id
        and (p.role in ('owner','admin'))
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = agents.organization_id
        and (p.role in ('owner','admin'))
    )
  );

-- Policies para agent_actions: checa organização via agent -> organization_id
create policy agent_actions_select on public.agent_actions
  for select using (
    exists (
      select 1
      from public.agents a
      join public.profiles p on p.id = auth.uid()
      where a.id = agent_actions.agent_id
        and p.organization_id = a.organization_id
    )
  );

create policy agent_actions_modify on public.agent_actions
  for all using (
    exists (
      select 1
      from public.agents a
      join public.profiles p on p.id = auth.uid()
      where a.id = agent_actions.agent_id
        and p.organization_id = a.organization_id
        and (p.role in ('owner','admin'))
    )
  ) with check (
    exists (
      select 1
      from public.agents a
      join public.profiles p on p.id = auth.uid()
      where a.id = agent_actions.agent_id
        and p.organization_id = a.organization_id
        and (p.role in ('owner','admin'))
    )
  );

-- Observação: o compartilhamento (público/usuários/grupos) será modelado em agent_shares (próximo passo)

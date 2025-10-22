-- external_actions: cadastro de ações externas invocáveis pelos agentes
create table if not exists public.external_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  url text not null,
  method text not null default 'POST',
  headers jsonb default '{}'::jsonb,
  auth jsonb default '{}'::jsonb, -- {type:'none'|'bearer'|'header', secret_env:'N8N_BEARER_TOKEN', header_name:'X-API-Key'}
  input_schema jsonb default '{}'::jsonb,
  output_schema jsonb default '{}'::jsonb,
  enabled boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

comment on table public.external_actions is 'Registry de ações externas (n8n) configuráveis por organização';

create index if not exists idx_external_actions_org on public.external_actions(organization_id);

-- Logs simples de execução (opcional; sem payloads sensíveis)
create table if not exists public.external_action_logs (
  id bigserial primary key,
  organization_id uuid not null,
  action_id uuid not null references public.external_actions(id) on delete cascade,
  agent_id uuid,
  conversation_id uuid,
  status int not null,
  duration_ms int,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_external_action_logs_org on public.external_action_logs(organization_id, created_at desc);
create index if not exists idx_external_action_logs_action on public.external_action_logs(action_id, created_at desc);

-- RLS
alter table public.external_actions enable row level security;
alter table public.external_action_logs enable row level security;

-- Supondo que profiles tem organization_id e role
-- Políticas: admins/owners da org podem gerenciar; demais podem ler (opcional)
create policy ext_actions_select on public.external_actions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = external_actions.organization_id
    )
  );

create policy ext_actions_modify on public.external_actions
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = external_actions.organization_id
        and (p.role in ('owner','admin'))
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = external_actions.organization_id
        and (p.role in ('owner','admin'))
    )
  );

create policy ext_action_logs_select on public.external_action_logs
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = external_action_logs.organization_id
    )
  );

-- Inserts em logs podem ser feitos pela função edge com service role; usuários finais não inserem
revoke all on public.external_action_logs from public;

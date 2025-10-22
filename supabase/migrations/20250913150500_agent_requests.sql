-- Tabela para solicitações de criação de agentes
create table if not exists public.agent_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  requester_name text not null,
  area text not null,
  description text not null,
  is_public boolean not null default false,
  status text not null default 'pending', -- pending | created | rejected
  agent_id uuid null references public.agents(id) on delete set null,
  processed_by uuid null references public.profiles(id) on delete set null,
  processed_at timestamp with time zone null,
  created_at timestamp with time zone not null default now()
);

comment on table public.agent_requests is 'Solicitações de criação de novos agentes feitas por membros';

alter table public.agent_requests enable row level security;

-- Inserção: o próprio usuário pode criar uma solicitação para sua organização
create policy agent_requests_insert_self
  on public.agent_requests for insert
  to authenticated
  with check (
    requester_id = auth.uid()
    and organization_id = (select organization_id from public.profiles where id = auth.uid())
  );

-- Seleção: o solicitante enxerga as próprias; gestores/admin/owner enxergam todas da organização
create policy agent_requests_select_org
  on public.agent_requests for select
  to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
    and (
      requester_id = auth.uid() or
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('bot_manager','admin','owner')
      )
    )
  );

-- Atualização (status, processed_by, processed_at, agent_id): apenas gestores/admin/owner da organização
create policy agent_requests_update_managers
  on public.agent_requests for update
  to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('bot_manager','admin','owner')
    )
  )
  with check (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
  );

-- Exclusão: opcionalmente apenas gestores/admin/owner (ou ninguém). Aqui permitimos apenas gestores/admin/owner
create policy agent_requests_delete_managers
  on public.agent_requests for delete
  to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('bot_manager','admin','owner')
    )
  );

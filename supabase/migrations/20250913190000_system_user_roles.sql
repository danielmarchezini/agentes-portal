-- system_user_roles: gerenciamento de OWNERS (SaaS)
-- Cria tabela, helpers e RPCs para promover/rebaixar OWNERs

create table if not exists public.system_user_roles (
  user_id uuid primary key,
  role text not null check (role in ('OWNER')),
  created_at timestamptz not null default now(),
  constraint system_user_roles_user_fk foreign key (user_id) references public.profiles(id) on delete cascade
);

-- Trigger updated_at: não necessário (somente created_at)

-- Helper: verifica se um usuário é OWNER
create or replace function public.is_owner(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.system_user_roles r
    where r.user_id = p_user_id and r.role = 'OWNER'
  );
$$;

alter function public.is_owner(uuid) owner to postgres;

-- RLS
alter table public.system_user_roles enable row level security;

-- SELECT: qualquer usuário autenticado pode ler (para o app saber quem é OWNER)
create policy system_user_roles_select_all
  on public.system_user_roles for select
  to authenticated
  using (true);

-- INSERT/DELETE/UPDATE via RPC com SECURITY DEFINER; bloquear direto por políticas
create policy system_user_roles_block_dml
  on public.system_user_roles for all
  to authenticated
  using (false)
  with check (false);

-- RPC: promover OWNER por email
create or replace function public.promote_owner(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  target uuid;
  has_any_owner boolean;
begin
  if caller is null then
    raise exception 'auth.uid() is null';
  end if;

  -- permite bootstrap: se não existe nenhum owner ainda, o primeiro caller pode promover
  select exists (select 1 from public.system_user_roles where role = 'OWNER') into has_any_owner;
  if has_any_owner and not public.is_owner(caller) then
    raise exception 'Somente OWNER pode promover outro OWNER';
  end if;

  select u.id into target from auth.users u where lower(u.email) = lower(target_email) limit 1;
  if target is null then
    raise exception 'Usuário com e-mail % não encontrado em auth.users', target_email;
  end if;

  insert into public.system_user_roles(user_id, role)
  values (target, 'OWNER')
  on conflict (user_id) do update set role = excluded.role;
end;
$$;

comment on function public.promote_owner(text) is 'Promove um usuário para OWNER por e-mail. Primeiro OWNER pode se autopromover (bootstrap).';

-- RPC: rebaixar OWNER por email
create or replace function public.demote_owner(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  target uuid;
begin
  if caller is null then
    raise exception 'auth.uid() is null';
  end if;

  if not public.is_owner(caller) then
    raise exception 'Somente OWNER pode rebaixar OWNER';
  end if;

  select u.id into target from auth.users u where lower(u.email) = lower(target_email) limit 1;
  if target is null then
    raise exception 'Usuário com e-mail % não encontrado em auth.users', target_email;
  end if;

  delete from public.system_user_roles where user_id = target and role = 'OWNER';
end;
$$;

comment on function public.demote_owner(text) is 'Remove o papel OWNER de um usuário identificado por e-mail.';

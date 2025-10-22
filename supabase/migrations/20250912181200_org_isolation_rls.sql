-- Isolamento por organização: view org_profiles e políticas RLS
-- Executar em ambiente Supabase/Postgres

-- 1) View: org_profiles (expõe organization_id e herda RLS da tabela profiles)
drop view if exists public.org_profiles cascade;
create view public.org_profiles as
select
  p.id,
  p.email,
  p.name,
  p.role,
  p.organization_id
from public.profiles p;

alter view public.org_profiles owner to postgres;

-- 2) Ativar RLS nas tabelas envolvidas
alter table if exists public.profiles enable row level security;
alter table if exists public.organization_invited_admins enable row level security;
alter table if exists public.organization_domains enable row level security;

-- 3) Políticas em profiles
-- Remove políticas antigas potencialmente conflitantes
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select'
  ) then execute 'drop policy profiles_select on public.profiles'; end if;
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update'
  ) then execute 'drop policy profiles_update on public.profiles'; end if;
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert'
  ) then execute 'drop policy profiles_insert on public.profiles'; end if;
end $$;

-- SELECT: apenas mesma organização do usuário atual, com exceção para system_owners
create policy profiles_select on public.profiles
for select using (
  organization_id is not distinct from (
    select p2.organization_id from public.profiles p2 where p2.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- UPDATE: apenas mesma organização (e owners globais se desejar)
create policy profiles_update on public.profiles
for update using (
  organization_id is not distinct from (
    select p2.organization_id from public.profiles p2 where p2.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- INSERT: normalmente controlado pela aplicação; deixar desabilitado por segurança
-- create policy profiles_insert on public.profiles
-- for insert with check ( false );

-- 4) Políticas em organization_invited_admins
-- Drop antigas
DO $$
BEGIN
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='organization_invited_admins' and policyname='org_invites_select')
  THEN execute 'drop policy org_invites_select on public.organization_invited_admins'; END IF;
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='organization_invited_admins' and policyname='org_invites_insert')
  THEN execute 'drop policy org_invites_insert on public.organization_invited_admins'; END IF;
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='organization_invited_admins' and policyname='org_invites_modify')
  THEN execute 'drop policy org_invites_modify on public.organization_invited_admins'; END IF;
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='organization_invited_admins' and policyname='org_invites_delete')
  THEN execute 'drop policy org_invites_delete on public.organization_invited_admins'; END IF;
END $$;

create policy org_invites_select on public.organization_invited_admins
for select using (
  organization_id is not distinct from (
    select p2.organization_id from public.profiles p2 where p2.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

create policy org_invites_insert on public.organization_invited_admins
for insert with check (
  organization_id is not distinct from (
    select p2.organization_id from public.profiles p2 where p2.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

create policy org_invites_modify on public.organization_invited_admins
for update using (
  organization_id is not distinct from (
    select p2.organization_id from public.profiles p2 where p2.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

create policy org_invites_delete on public.organization_invited_admins
for delete using (
  organization_id is not distinct from (
    select p2.organization_id from public.profiles p2 where p2.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- 5) Políticas em organization_domains
-- Drop antigas
DO $$
BEGIN
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='organization_domains' and policyname='org_domains_select')
  THEN execute 'drop policy org_domains_select on public.organization_domains'; END IF;
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='organization_domains' and policyname='org_domains_insert')
  THEN execute 'drop policy org_domains_insert on public.organization_domains'; END IF;
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='organization_domains' and policyname='org_domains_modify')
  THEN execute 'drop policy org_domains_modify on public.organization_domains'; END IF;
  IF exists (select 1 from pg_policies where schemaname='public' and tablename='organization_domains' and policyname='org_domains_delete')
  THEN execute 'drop policy org_domains_delete on public.organization_domains'; END IF;
END $$;

create policy org_domains_select on public.organization_domains
for select using (
  organization_id is not distinct from (
    select p2.organization_id from public.profiles p2 where p2.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

create policy org_domains_insert on public.organization_domains
for insert with check (
  organization_id is not distinct from (
    select p2.organization_id from public.profiles p2 where p2.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

create policy org_domains_modify on public.organization_domains
for update using (
  organization_id is not distinct from (
    select p2.organization_id from public.profiles p2 where p2.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

create policy org_domains_delete on public.organization_domains
for delete using (
  organization_id is not distinct from (
    select p2.organization_id from public.profiles p2 where p2.id = auth.uid() limit 1
  )
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

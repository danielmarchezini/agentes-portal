-- Conceder SELECT em system_owners para o papel authenticated
-- e criar políticas RLS para organizations

-- 1) Permissão de SELECT em system_owners
-- Permite que as subqueries nas políticas de RLS consigam ler a tabela.
grant select on table public.system_owners to authenticated;
grant select on table public.system_owners to anon;

-- 2) Ativar RLS em organizations
alter table if exists public.organizations enable row level security;

-- 3) Remover políticas antigas de organizations (se houver)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organizations' AND policyname='orgs_select_self'
  ) THEN EXECUTE 'DROP POLICY orgs_select_self ON public.organizations'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organizations' AND policyname='orgs_select_owner'
  ) THEN EXECUTE 'DROP POLICY orgs_select_owner ON public.organizations'; END IF;
END $$;

-- 4) Política de SELECT para organizations
-- Permite que usuários vejam a própria organização e que owners globais vejam todas.
CREATE POLICY orgs_select ON public.organizations
FOR SELECT
TO authenticated
USING (
  -- Usuário pode ver a própria organização
  id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  -- Owner global pode ver todas as organizações
  OR EXISTS (
    SELECT 1 FROM public.system_owners so
    WHERE lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- 5) Grant de SELECT em organizations para authenticated
-- Necessário para que as políticas RLS sejam avaliadas para o papel.
grant select on table public.organizations to authenticated;

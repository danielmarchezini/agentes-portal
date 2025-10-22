-- Reapertar RLS de profiles: remover política permissiva e recriar políticas finas

-- Garantir RLS ativa
alter table if exists public.profiles enable row level security;

-- Remover políticas permissivas e duplicadas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select'
  ) THEN EXECUTE 'DROP POLICY profiles_select ON public.profiles'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_self'
  ) THEN EXECUTE 'DROP POLICY profiles_select_self ON public.profiles'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update'
  ) THEN EXECUTE 'DROP POLICY profiles_update ON public.profiles'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_self'
  ) THEN EXECUTE 'DROP POLICY profiles_update_self ON public.profiles'; END IF;
END $$;

-- Política SELECT (fina) para authenticated
-- Permite:
-- 1) Self-access por id ou email do JWT
-- 2) Mesma organização do usuário autenticado
-- 3) Exceção para owners globais (system_owners)
CREATE POLICY profiles_select ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  OR organization_id IS NOT DISTINCT FROM (
    SELECT p2.organization_id FROM public.profiles p2 WHERE p2.id = auth.uid() LIMIT 1
  )
  OR EXISTS (
    SELECT 1 FROM public.system_owners so
    WHERE lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- Política UPDATE (fina) para authenticated
CREATE POLICY profiles_update ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  OR organization_id IS NOT DISTINCT FROM (
    SELECT p2.organization_id FROM public.profiles p2 WHERE p2.id = auth.uid() LIMIT 1
  )
  OR EXISTS (
    SELECT 1 FROM public.system_owners so
    WHERE lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- Garantir grants
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

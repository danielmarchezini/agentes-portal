-- Tornar explícito o papel 'authenticated' nas políticas de SELECT/UPDATE de profiles
-- Unificar a política de SELECT e garantir que usuários autenticados sempre consigam
-- ler o próprio profile, além do isolamento por organização e exceção para owners globais.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_self'
  ) THEN EXECUTE 'DROP POLICY profiles_select_self ON public.profiles'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_self'
  ) THEN EXECUTE 'DROP POLICY profiles_update_self ON public.profiles'; END IF;
  -- Drop a principal para recriar
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select'
  ) THEN EXECUTE 'DROP POLICY profiles_select ON public.profiles'; END IF;
END $$;

-- SELECT consolidada para o papel authenticated
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

-- UPDATE mantém o self-access e exceções; opcionalmente restringir ao papel authenticated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update'
  ) THEN EXECUTE 'DROP POLICY profiles_update ON public.profiles'; END IF;
END $$;

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

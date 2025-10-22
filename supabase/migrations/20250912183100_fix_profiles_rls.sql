-- Fix RLS: permitir sempre SELECT/UPDATE do próprio profile (id = auth.uid())
-- e manter isolamento por organização, com exceção para owners globais

-- Remover políticas antigas para recriar de forma idempotente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select'
  ) THEN EXECUTE 'DROP POLICY profiles_select ON public.profiles'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update'
  ) THEN EXECUTE 'DROP POLICY profiles_update ON public.profiles'; END IF;
END $$;

-- Política de SELECT
CREATE POLICY profiles_select ON public.profiles
FOR SELECT USING (
  -- Sempre pode ver o próprio registro
  id = auth.uid()
  OR organization_id IS NOT DISTINCT FROM (
    SELECT p2.organization_id FROM public.profiles p2 WHERE p2.id = auth.uid() LIMIT 1
  )
  OR EXISTS (
    SELECT 1 FROM public.system_owners so
    WHERE lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- Política de UPDATE (ajuste conforme necessidade)
CREATE POLICY profiles_update ON public.profiles
FOR UPDATE USING (
  -- Sempre pode alterar o próprio registro
  id = auth.uid()
  OR organization_id IS NOT DISTINCT FROM (
    SELECT p2.organization_id FROM public.profiles p2 WHERE p2.id = auth.uid() LIMIT 1
  )
  OR EXISTS (
    SELECT 1 FROM public.system_owners so
    WHERE lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- Atualiza RLS de organizations: inclui fallback por email do JWT

-- Garante RLS ativa
alter table if exists public.organizations enable row level security;

-- Drop da política existente para recriar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organizations' AND policyname='orgs_select'
  ) THEN EXECUTE 'DROP POLICY orgs_select ON public.organizations'; END IF;
END $$;

-- Política consolidada de SELECT para organizations
-- Permite ver:
-- 1) A própria organização (via profiles.id = auth.uid())
-- 2) A própria organização (via profiles.email = jwt.email) [fallback]
-- 3) Todas, se for owner global (system_owners)
CREATE POLICY orgs_select ON public.organizations
FOR SELECT
TO authenticated
USING (
  id = (
    SELECT p2.organization_id FROM public.profiles p2 WHERE p2.id = auth.uid() LIMIT 1
  )
  OR id = (
    SELECT p3.organization_id FROM public.profiles p3 WHERE lower(p3.email) = lower(coalesce((auth.jwt() ->> 'email'), '')) LIMIT 1
  )
  OR EXISTS (
    SELECT 1 FROM public.system_owners so
    WHERE lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- Grant explícito para garantir avaliação
GRANT SELECT ON TABLE public.organizations TO authenticated;

-- Fix profiles RLS recursion by introducing SECURITY DEFINER helper and updating policies

-- 1) Helper to fetch current user's organization without RLS recursion
CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_org() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_org() TO authenticated;

-- 2) Ensure RLS is enabled
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- 3) Replace SELECT and UPDATE policies to use the helper (avoid selecting profiles inside profiles policy)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select') THEN
    EXECUTE 'DROP POLICY profiles_select ON public.profiles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update') THEN
    EXECUTE 'DROP POLICY profiles_update ON public.profiles';
  END IF;
END $$;

-- SELECT policy
CREATE POLICY profiles_select ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  OR organization_id IS NOT DISTINCT FROM public.current_user_org()
  OR public.is_system_owner()
);

-- UPDATE policy
CREATE POLICY profiles_update ON public.profiles
FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  OR organization_id IS NOT DISTINCT FROM public.current_user_org()
  OR public.is_system_owner()
) WITH CHECK (
  organization_id IS NOT DISTINCT FROM public.current_user_org()
);

-- 4) Grants
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

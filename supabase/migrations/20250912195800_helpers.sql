-- Helpers (pre-req): system owner check
-- Safe to run multiple times (CREATE OR REPLACE)

-- Table system_owners expected: public.system_owners(email text primary key, created_at timestamptz)
-- If it doesn't exist yet, create a minimal version (no harm if exists elsewhere)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='system_owners'
  ) THEN
    CREATE TABLE public.system_owners (
      email text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_owners TO authenticated;
  END IF;
END $$;

-- Function: is_system_owner()
CREATE OR REPLACE FUNCTION public.is_system_owner()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_owners so
    WHERE lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
$$;

REVOKE ALL ON FUNCTION public.is_system_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_system_owner() TO authenticated;

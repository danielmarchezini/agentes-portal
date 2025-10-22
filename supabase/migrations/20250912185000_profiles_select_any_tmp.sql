-- TEMP: Desbloquear SELECT em profiles para usuários autenticados
-- Objetivo: eliminar 500 enquanto validamos políticas finas

-- 1) Habilitar RLS (se ainda não estiver)
alter table if exists public.profiles enable row level security;

-- 2) Remover políticas de SELECT existentes para recriar de forma limpa
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select'
  ) THEN EXECUTE 'DROP POLICY profiles_select ON public.profiles'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_self'
  ) THEN EXECUTE 'DROP POLICY profiles_select_self ON public.profiles'; END IF;
END $$;

-- 3) Política permissiva de SELECT para authenticated
CREATE POLICY profiles_select ON public.profiles
FOR SELECT
TO authenticated
USING ( true );

-- 4) Grant explícito (garantir que o papel consiga invocar a política)
GRANT SELECT ON TABLE public.profiles TO authenticated;

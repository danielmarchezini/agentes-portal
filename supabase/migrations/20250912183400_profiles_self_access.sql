-- Políticas adicionais para garantir acesso ao próprio profile sem depender de subqueries
-- Mantém as políticas existentes; adiciona regras explícitas de self-access por id/email

-- Drop prévio para idempotência
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_self'
  ) THEN EXECUTE 'DROP POLICY profiles_select_self ON public.profiles'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_self'
  ) THEN EXECUTE 'DROP POLICY profiles_update_self ON public.profiles'; END IF;
END $$;

-- SELECT: self-access
create policy profiles_select_self on public.profiles
for select using (
  id = auth.uid()
  or lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

-- UPDATE: self-access
create policy profiles_update_self on public.profiles
for update using (
  id = auth.uid()
  or lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  or exists (
    select 1 from public.system_owners so
    where lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

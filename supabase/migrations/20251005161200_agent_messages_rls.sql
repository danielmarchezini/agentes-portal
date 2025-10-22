-- Habilita RLS e cria políticas por organização para public.agent_messages
-- Escopo: mensagens visíveis e inseríveis apenas dentro da mesma organização do usuário
-- Admins/owners/bot_manager podem apagar mensagens da sua organização; usuário pode apagar suas próprias mensagens

-- 1) Garantir que a tabela exista
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agent_messages'
  ) THEN
    RAISE EXCEPTION 'Tabela public.agent_messages não existe. Aplique a migration de message_history primeiro.';
  END IF;
END $$;

-- 2) Habilitar RLS
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- 3) Dropar políticas antigas, se existirem (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agent_messages' AND policyname='agent_messages_select') THEN
    EXECUTE 'DROP POLICY agent_messages_select ON public.agent_messages';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agent_messages' AND policyname='agent_messages_insert') THEN
    EXECUTE 'DROP POLICY agent_messages_insert ON public.agent_messages';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agent_messages' AND policyname='agent_messages_delete') THEN
    EXECUTE 'DROP POLICY agent_messages_delete ON public.agent_messages';
  END IF;
END $$;

-- 4) Helpers esperados: current_user_org() e is_system_owner()
-- Se não existirem, as migrações anteriores devem criá-los (ver 20250912193700_fix_profiles_rls_recursion.sql e 20250912195800_helpers.sql)

-- 5) SELECT: membros só veem mensagens de agentes da própria organização; system owners veem tudo
CREATE POLICY agent_messages_select ON public.agent_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = agent_messages.agent_id
      AND (
        a.organization_id IS NOT DISTINCT FROM public.current_user_org()
        OR public.is_system_owner()
      )
  )
);

-- 6) INSERT: membros só inserem mensagens para agentes da própria org
-- Regras adicionais:
-- - Se role = 'user', então user_id deve ser auth.uid()
-- - Se role = 'assistant', user_id pode ser NULL ou auth.uid()
CREATE POLICY agent_messages_insert ON public.agent_messages
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = agent_messages.agent_id
      AND (
        a.organization_id IS NOT DISTINCT FROM public.current_user_org()
        OR public.is_system_owner()
      )
  )
  AND (
    (role = 'user' AND user_id IS NOT DISTINCT FROM auth.uid())
    OR (role = 'assistant')
  )
);

-- 7) DELETE: permitir
--   (a) system owners (global)
--   (b) membros com papel admin/owner/bot_manager na org da mensagem
--   (c) o próprio autor pode deletar mensagens de role='user' que são suas
CREATE POLICY agent_messages_delete ON public.agent_messages
FOR DELETE TO authenticated
USING (
  public.is_system_owner()
  OR EXISTS (
    SELECT 1
    FROM public.agents a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.id = agent_messages.agent_id
      AND a.organization_id IS NOT DISTINCT FROM p.organization_id
      AND p.role IN ('owner','admin','bot_manager')
  )
  OR (
    role = 'user' AND user_id IS NOT DISTINCT FROM auth.uid()
  )
);

-- Nota: Não criamos política de UPDATE para evitar adulteração de histórico. Se necessário, adicionar futuramente com as mesmas restrições de org/papel.

-- 8) Grants para o papel authenticated (requeridos pelo PostgREST, RLS continua aplicando as políticas)
GRANT SELECT, INSERT, DELETE ON TABLE public.agent_messages TO authenticated;

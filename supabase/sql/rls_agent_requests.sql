-- RLS para a tabela agent_requests
-- Regras:
-- - Membros podem INSERIR solicitações para sua própria organização e LER apenas as próprias solicitações
-- - Admin / Owner / Bot Manager podem LER TODAS as solicitações da organização e ATUALIZAR status (processar)
-- - DELETE normalmente não é necessário; ajuste conforme sua política

ALTER TABLE agent_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: requester vê as próprias; admins/owners/bot_managers veem todas da organização
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'agent_requests' AND policyname = 'agent_requests_select_scope'
  ) THEN
    CREATE POLICY agent_requests_select_scope ON agent_requests
      FOR SELECT USING (
        requester_id = auth.uid()
        OR (
          organization_id IN (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
          )
          AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin','owner','bot_manager')
          )
        )
      );
  END IF;
END $$;

-- INSERT: usuário pode criar na própria organização
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'agent_requests' AND policyname = 'agent_requests_insert_own_org'
  ) THEN
    CREATE POLICY agent_requests_insert_own_org ON agent_requests
      FOR INSERT WITH CHECK (
        requester_id = auth.uid()
        AND organization_id = (SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid())
      );
  END IF;
END $$;

-- UPDATE: admins/owners/bot_managers da mesma organização podem atualizar (processar)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'agent_requests' AND policyname = 'agent_requests_update_admins'
  ) THEN
    CREATE POLICY agent_requests_update_admins ON agent_requests
      FOR UPDATE USING (
        organization_id IN (
          SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin','owner','bot_manager')
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin','owner','bot_manager')
        )
      );
  END IF;
END $$;

-- Opcional: DELETE restrito a admins/owners
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'agent_requests' AND policyname = 'agent_requests_delete_admins'
  ) THEN
    CREATE POLICY agent_requests_delete_admins ON agent_requests
      FOR DELETE USING (
        organization_id IN (
          SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin','owner')
        )
      );
  END IF;
END $$;

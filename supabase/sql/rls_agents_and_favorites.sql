-- Policies para resolver erros 403 em /rest/v1/agents e 404 para agent_favorites
-- Execute este script no SQL Editor do Supabase.

-- 1) Tabela de favoritos (se ainda não existir)
CREATE TABLE IF NOT EXISTS agent_favorites (
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id, agent_id)
);

-- RLS para favorites
ALTER TABLE agent_favorites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'agent_favorites' AND policyname = 'favorites_select_own'
  ) THEN
    CREATE POLICY favorites_select_own ON agent_favorites
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'agent_favorites' AND policyname = 'favorites_insert_own'
  ) THEN
    CREATE POLICY favorites_insert_own ON agent_favorites
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'agent_favorites' AND policyname = 'favorites_delete_own'
  ) THEN
    CREATE POLICY favorites_delete_own ON agent_favorites
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2) Políticas básicas para agents para permitir leitura/criação por membros
-- OBS: Ajuste conforme seu modelo de segurança. Este é um conjunto inicial mínimo.
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- SELECT: dono do agente, ou compartilhado com ele (agent_shares), ou público na mesma org
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'agents' AND policyname = 'agents_select_owner_or_shared_or_public'
  ) THEN
    CREATE POLICY agents_select_owner_or_shared_or_public ON agents
      FOR SELECT USING (
        -- Dono do agente
        created_by = auth.uid()
        OR
        -- Compartilhado diretamente com o usuário
        EXISTS (
          SELECT 1 FROM agent_shares s
          WHERE s.organization_id = agents.organization_id
            AND s.agent_id = agents.id
            AND s.target_type = 'user'
            AND s.target_user_id = auth.uid()
        )
        OR
        -- Compartilhado como público na mesma organização
        EXISTS (
          SELECT 1 FROM agent_shares s
          WHERE s.organization_id = agents.organization_id
            AND s.agent_id = agents.id
            AND s.target_type = 'public'
        )
      );
  END IF;
END $$;

-- INSERT: usuário autenticado pode criar agentes dentro da própria organização
-- (assume que profiles.organization_id é a organização do usuário)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'agents' AND policyname = 'agents_insert_in_own_org'
  ) THEN
    CREATE POLICY agents_insert_in_own_org ON agents
      FOR INSERT WITH CHECK (
        created_by = auth.uid()
        AND organization_id = (
          SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
      );
  END IF;
END $$;

-- UPDATE: permitir ao dono editar; permissões avançadas podem ser tratadas via agent_shares (permission = 'edit'/'admin')
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'agents' AND policyname = 'agents_update_owner'
  ) THEN
    CREATE POLICY agents_update_owner ON agents
      FOR UPDATE USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- DELETE: permitir ao dono excluir o próprio agente
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'agents' AND policyname = 'agents_delete_owner'
  ) THEN
    CREATE POLICY agents_delete_owner ON agents
      FOR DELETE USING (created_by = auth.uid());
  END IF;
END $$;

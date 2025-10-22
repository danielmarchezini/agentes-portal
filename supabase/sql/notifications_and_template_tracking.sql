-- Notifications + Template tracking for agents
-- 1) Track which template an agent was created from (so we can notify users)
-- 2) Notify users when a template is updated (owner choice to update or not is handled in UI)

-- Add versioning to templates (simple counter)
ALTER TABLE IF EXISTS agent_templates
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Add tracking to agents
ALTER TABLE IF EXISTS agents
  ADD COLUMN IF NOT EXISTS template_id uuid NULL,
  ADD COLUMN IF NOT EXISTS template_version integer NULL,
  ADD COLUMN IF NOT EXISTS template_title text NULL;

CREATE INDEX IF NOT EXISTS idx_agents_template_id ON agents(template_id);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NULL,
  data jsonb NULL,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- (Optional) RLS - adjust as needed for your project
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'notifications' AND policyname = 'Users can read own notifications'
  ) THEN
    CREATE POLICY "Users can read own notifications" ON notifications
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'notifications' AND policyname = 'Service role can insert notifications'
  ) THEN
    CREATE POLICY "Service role can insert notifications" ON notifications
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- RPC + helper to notify users affected by a template update
CREATE OR REPLACE FUNCTION notify_users_template_updated(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tpl record;
BEGIN
  SELECT id, title, version, organization_id INTO v_tpl
  FROM agent_templates WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template % não encontrado', p_template_id;
  END IF;

  -- Notifica todos os donos de agentes criados a partir deste template
  INSERT INTO notifications (user_id, organization_id, type, title, body, data)
  SELECT DISTINCT a.owner_id, a.organization_id, 'template_updated',
         'Template atualizado: ' || COALESCE(v_tpl.title,'(sem título)'),
         'Um template que você usa foi melhorado. Deseja atualizar seu agente agora?',
         jsonb_build_object(
           'template_id', v_tpl.id,
           'template_title', v_tpl.title,
           'new_version', v_tpl.version,
           'agent_id', a.id
         )
  FROM agents a
  WHERE a.template_id = v_tpl.id AND a.owner_id IS NOT NULL;
END;
$$;

-- Exemplo: após atualizar um template, incremente a versão e notifique
-- UPDATE agent_templates SET version = version + 1, title = title WHERE id = '<tpl_id>';
-- SELECT notify_users_template_updated('<tpl_id>'::uuid);

-- (Opcional) Trigger para notificar automaticamente quando version mudar
DROP TRIGGER IF EXISTS trg_template_notify_update ON agent_templates;
DROP FUNCTION IF EXISTS trg_fn_template_notify_update();
CREATE OR REPLACE FUNCTION trg_fn_template_notify_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.version IS DISTINCT FROM OLD.version THEN
    PERFORM notify_users_template_updated(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_template_notify_update
AFTER UPDATE ON agent_templates
FOR EACH ROW
EXECUTE FUNCTION trg_fn_template_notify_update();

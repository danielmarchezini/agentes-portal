-- Policies para evitar 403 em agent_templates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agent_templates'
  ) THEN
    ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;
    -- Idempotente: permitir SELECT para authenticated e anon
    drop policy if exists agent_templates_select_all on public.agent_templates;
    create policy agent_templates_select_all on public.agent_templates
    for select to authenticated, anon
    using (true);
  END IF;
END $$;

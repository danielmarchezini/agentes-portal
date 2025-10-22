-- agent_templates: marketplace (globais do OWNER e por organização)
-- Cria enum de visibilidade, tabela, índices, trigger de updated_at e policies RLS

-- Enum de visibilidade
DO $$ BEGIN
  CREATE TYPE public.template_visibility AS ENUM ('global', 'org');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.agent_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  title text NOT NULL,
  description text,
  category text,
  tags text[],

  visibility public.template_visibility NOT NULL,
  owner_id uuid NULL, -- quando global (OWNER)
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE, -- quando org
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  config jsonb NOT NULL,
  is_featured boolean NOT NULL DEFAULT false
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_agent_templates_visibility ON public.agent_templates(visibility);
CREATE INDEX IF NOT EXISTS idx_agent_templates_org ON public.agent_templates(organization_id) WHERE visibility = 'org';
CREATE INDEX IF NOT EXISTS idx_agent_templates_category ON public.agent_templates(category);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER set_agent_templates_updated_at
  BEFORE UPDATE ON public.agent_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;

-- SELECT
-- 1) Global visível para todos os autenticados
CREATE POLICY agent_templates_select_global
  ON public.agent_templates FOR SELECT
  TO authenticated
  USING (visibility = 'global');

-- 2) Org visível apenas a membros da respectiva organização
--    Assumimos que o JWT tem a claim organization_id (ajuste se necessário)
CREATE POLICY agent_templates_select_org
  ON public.agent_templates FOR SELECT
  TO authenticated
  USING (
    visibility = 'org' AND (
      (current_setting('request.jwt.claims', true)::json ->> 'organization_id') IS NOT NULL
      AND (current_setting('request.jwt.claims', true)::json ->> 'organization_id')::uuid = organization_id
    )
  );

-- INSERT/UPDATE/DELETE
-- 3) Global: apenas OWNER pode inserir/alterar/excluir
CREATE POLICY agent_templates_dml_global
  ON public.agent_templates FOR ALL
  TO authenticated
  USING (
    visibility = 'global' AND public.is_owner(auth.uid())
  )
  WITH CHECK (
    visibility = 'global' AND public.is_owner(auth.uid())
  );

-- 4) Org: membros da organização podem inserir/alterar/excluir dentro da própria org
CREATE POLICY agent_templates_dml_org
  ON public.agent_templates FOR ALL
  TO authenticated
  USING (
    visibility = 'org' AND (
      (current_setting('request.jwt.claims', true)::json ->> 'organization_id') IS NOT NULL
      AND (current_setting('request.jwt.claims', true)::json ->> 'organization_id')::uuid = organization_id
    )
  )
  WITH CHECK (
    visibility = 'org' AND (
      (current_setting('request.jwt.claims', true)::json ->> 'organization_id') IS NOT NULL
      AND (current_setting('request.jwt.claims', true)::json ->> 'organization_id')::uuid = organization_id
    )
  );

-- View (opcional): facilitar listagem com escopo
-- CREATE VIEW public.v_agent_templates AS
-- SELECT * FROM public.agent_templates;

COMMENT ON TABLE public.agent_templates IS 'Templates do Marketplace: globais (OWNER) e por organização';

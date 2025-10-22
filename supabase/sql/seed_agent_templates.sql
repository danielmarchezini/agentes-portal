-- Seed de Templates Globais reais para o Marketplace
-- Execute este script no Supabase SQL Editor do seu projeto.
-- Ele busca automaticamente o primeiro usuário com papel de Owner Global/System Admin
-- para preencher o campo author_id (FK obrigatória) e publica 4 templates globais.

DO $$
DECLARE
  v_author UUID;
BEGIN
  -- Autor informado manualmente pelo usuário
  v_author := '28ef1818-455e-4ecb-ae21-06cc9a19bb31'::uuid;

  -- 2) Insere Templates Globais (se não existirem por title)
  -- Observação: ajuste os modelos/configs conforme seu suporte atual

  -- Assistente de Redação
  INSERT INTO agent_templates (title, description, category, tags, visibility, organization_id, owner_id, author_id, config)
  SELECT 'Assistente de Redação',
         'Especializado em criação de conteúdo, blogs e artigos profissionais',
         'Criatividade',
         ARRAY['redação','conteúdo','marketing','blog'],
         'global',
         NULL,
         NULL,
         v_author,
         jsonb_build_object(
           'model','gpt-4o-mini',
           'system_prompt','Você é um especialista em redação e criação de conteúdo. Ajude a criar textos claros, envolventes e bem estruturados para diversos fins: blogs, artigos, posts em redes sociais, newsletters e materiais de marketing. Considere o tom da marca e o público-alvo.'
         )
  WHERE NOT EXISTS (
    SELECT 1 FROM agent_templates WHERE visibility='global' AND title='Assistente de Redação'
  );

  -- Analista de Dados
  INSERT INTO agent_templates (title, description, category, tags, visibility, organization_id, owner_id, author_id, config)
  SELECT 'Analista de Dados',
         'Interpreta dados, cria insights e gera relatórios executivos',
         'Análise',
         ARRAY['dados','análise','relatórios','insights'],
         'global',
         NULL,
         NULL,
         v_author,
         jsonb_build_object(
           'model','gpt-4o-mini',
           'system_prompt','Você é um analista de dados experiente. Ajude a interpretar dados, identificar padrões, criar visualizações e gerar insights acionáveis. Apresente conclusões de forma clara e objetiva, com recomendações práticas.'
         )
  WHERE NOT EXISTS (
    SELECT 1 FROM agent_templates WHERE visibility='global' AND title='Analista de Dados'
  );

  -- Especialista em Email Marketing
  INSERT INTO agent_templates (title, description, category, tags, visibility, organization_id, owner_id, author_id, config)
  SELECT 'Especialista em Email Marketing',
         'Cria campanhas de email marketing eficazes e personalizadas',
         'Marketing',
         ARRAY['email','marketing','campanhas','conversão'],
         'global',
         NULL,
         NULL,
         v_author,
         jsonb_build_object(
           'model','gpt-4o-mini',
           'system_prompt','Você é um especialista em email marketing. Crie campanhas eficazes, linhas de assunto atrativas, copy persuasivo e sequências de automação com foco em conversão.'
         )
  WHERE NOT EXISTS (
    SELECT 1 FROM agent_templates WHERE visibility='global' AND title='Especialista em Email Marketing'
  );

  -- Consultor de SEO
  INSERT INTO agent_templates (title, description, category, tags, visibility, organization_id, owner_id, author_id, config)
  SELECT 'Consultor de SEO',
         'Otimiza conteúdo para mecanismos de busca e melhora rankings',
         'SEO',
         ARRAY['seo','otimização','keywords','ranking'],
         'global',
         NULL,
         NULL,
         v_author,
         jsonb_build_object(
           'model','gpt-4o-mini',
           'system_prompt','Você é um consultor de SEO experiente. Otimize conteúdo, pesquise palavras-chave, analise competidores e proponha estratégias técnicas e de conteúdo.'
         )
  WHERE NOT EXISTS (
    SELECT 1 FROM agent_templates WHERE visibility='global' AND title='Consultor de SEO'
  );

END$$;

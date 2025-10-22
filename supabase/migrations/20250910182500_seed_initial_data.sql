-- Seed initial data: organization and agents (no inserts into auth.users)

-- Insert Organization (idempotent)
INSERT INTO public.organizations (id, name, domain, cnpj, address, contacts, contract, notifications, llm_providers, branding)
VALUES (
    'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    'Acme Corporation',
    'acme.com',
    '12.345.678/0001-90',
    '{"street": "Rua das Empresas", "number": "123", "city": "São Paulo", "state": "SP", "zipCode": "01234-567", "neighborhood": "Centro Empresarial"}',
    '{"phone": "(11) 9999-8888", "email": "contato@acme.com", "responsibleName": "João Silva", "responsibleRole": "CEO"}',
    '{"plan": "Enterprise", "status": "active", "monthlyValue": 2500.00, "startDate": "2024-01-01", "expirationDate": "2024-12-31"}',
    '{"brandColor": "#0ea5e9", "emailTemplates": {"welcome": "Bem-vindo!", "invitation": "Você foi convidado.", "passwordReset": "Redefina sua senha."}}',
    '[{"id": "openai", "name": "OpenAI", "enabled": true, "models": [{"id": "gpt-4", "name": "GPT-4"}], "apiKeyRequired": true}]',
    '{"logo": "", "colors": {"primary": "222.2 84% 4.9%", "secondary": "210 40% 98%", "accent": "210 40% 96%"}}'
) ON CONFLICT (id) DO NOTHING;

-- Insert Agents (idempotent; created_by will be set later once profiles exist)
INSERT INTO public.agents (id, name, description, category, model, system_prompt, status, organization_id, tags)
VALUES 
    ('d1b2c3d4-e5f6-7890-1234-567890abcde3', 'Assistente de Análise', 'Especializado em análise de dados e relatórios', 'Análise', 'gpt-4', 'Você é um especialista em análise de dados...', 'active', 'a1b2c3d4-e5f6-7890-1234-567890abcdef', '["análise", "dados", "relatórios"]'),
    ('e1b2c3d4-e5f6-7890-1234-567890abcde4', 'Criativo Marketing', 'Criação de conteúdo e campanhas de marketing', 'Criatividade', 'gpt-4', 'Você é um especialista em marketing criativo...', 'active', 'a1b2c3d4-e5f6-7890-1234-567890abcdef', '["marketing", "criatividade", "conteúdo"]')
ON CONFLICT (id) DO NOTHING;

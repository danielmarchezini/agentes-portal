-- Migration para adicionar o provedor 'replicate' à constraint da tabela org_llm_secrets

-- Remover a constraint existente
alter table public.org_llm_secrets drop constraint org_llm_secrets_provider_check;

-- Adicionar a nova constraint incluindo 'replicate'
alter table public.org_llm_secrets add constraint org_llm_secrets_provider_check 
check (provider in ('openai','anthropic','google','perplexity','ollama','replicate'));

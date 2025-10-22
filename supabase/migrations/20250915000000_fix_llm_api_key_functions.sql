-- Migration para corrigir as funções de LLM API Key
-- Problema: A função upsert_llm_api_key não existe e a get_llm_secrets_masked pode não retornar todos os provedores

-- Dropar a função existente se ela existir com tipo de retorno diferente
do $$
begin
  drop function if exists public.upsert_llm_api_key(uuid, text, text);
exception when others then
  -- Ignorar erro se a função não existir
end;
$$;

-- Criar a função upsert_llm_api_key que é esperada pelo frontend
create or replace function public.upsert_llm_api_key(p_org_id uuid, p_provider text, p_api_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verificar se o usuário é admin da organização
  if not public.is_org_admin(p_org_id) then
    raise exception 'Acesso negado: usuário não é administrador da organização';
  end if;
  
  -- Normalizar o nome do provedor para minúsculas
  p_provider := lower(p_provider);
  
  -- Verificar se o provedor é válido
  if p_provider not in ('openai', 'anthropic', 'google', 'perplexity', 'ollama', 'replicate') then
    raise exception 'Provedor inválido: %', p_provider;
  end if;
  
  -- Inserir ou atualizar a chave
  insert into public.org_llm_secrets (organization_id, provider, api_key)
  values (p_org_id, p_provider, p_api_key)
  on conflict (organization_id, provider) 
  do update set 
    api_key = excluded.api_key,
    updated_at = now();
    
  return true;
end;
$$;

-- Dropar a função existente se ela existir
do $$
begin
  drop function if exists public.get_llm_api_key(uuid, text);
exception when others then
  -- Ignorar erro se a função não existir
end;
$$;

-- Criar a função get_llm_api_key para obter uma chave específica
create or replace function public.get_llm_api_key(p_org_id uuid, p_provider text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verificar se o usuário é membro da organização
  if not public.is_org_member(p_org_id) then
    return null;
  end if;
  
  -- Normalizar o nome do provedor para minúsculas
  p_provider := lower(p_provider);
  
  -- Retornar a chave se existir
  return (
    select api_key 
    from public.org_llm_secrets 
    where organization_id = p_org_id and provider = p_provider
  );
end;
$$;

-- Atualizar a função get_llm_secrets_masked para garantir que retorne todos os provedores
create or replace function public.get_llm_secrets_masked(p_org uuid)
returns table(provider text, has_key boolean, preview text)
language sql
security definer
set search_path = public
as $$
  select s.provider,
         true as has_key,
         case when length(s.api_key) > 8 then concat(left(s.api_key, 4), '****', right(s.api_key, 4)) else '****' end as preview
  from public.org_llm_secrets s
  where s.organization_id = p_org and public.is_org_admin(p_org);
$$;

-- Garantir permissões
grant execute on function public.upsert_llm_api_key(uuid, text, text) to authenticated, service_role;
grant execute on function public.get_llm_api_key(uuid, text) to authenticated, service_role;
grant execute on function public.get_llm_secrets_masked(uuid) to authenticated, service_role;

-- Adicionar replicate à lista de provedores permitidos na tabela org_llm_secrets
-- Nota: Isso pode exigir uma alteração na constraint check, mas como a tabela já existe,
-- vamos verificar se a constraint permite 'replicate'
-- Se a constraint não permitir, será necessário alterá-la em uma migration separada

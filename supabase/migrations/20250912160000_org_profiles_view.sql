-- View: public.org_profiles
-- Exibe usuários com colunas padronizadas usadas pelo frontend.
-- Observação: RLS continua sendo aplicada a partir da tabela base `public.profiles`.

create or replace view public.org_profiles as
select
  p.id,
  p.email,
  p.name,
  p.role,
  -- Campos opcionais padronizados para o frontend (retornam NULL se não existirem no schema base)
  null::timestamptz as created_at,
  null::text as status,
  null::timestamptz as last_login
from public.profiles p;

comment on view public.org_profiles is 'View padronizada de perfis para o frontend. RLS herdada da tabela base.';

-- Não é possível habilitar RLS diretamente em views; a segurança vem das políticas na tabela base.

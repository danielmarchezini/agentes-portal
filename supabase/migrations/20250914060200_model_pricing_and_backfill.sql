-- model_pricing_and_backfill.sql
-- Cria tabela de preços por modelo/provedor e RPC de recálculo de custos

begin;

-- Garante função gen_random_uuid
create extension if not exists pgcrypto;

-- 1) Tabela de preços
create table if not exists public.model_pricing (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  provider text not null,
  model text not null,
  prompt_per_mtokens numeric not null,
  completion_per_mtokens numeric not null,
  created_at timestamptz not null default now(),
  unique(organization_id, provider, model)
);

-- RLS opcional (ajuste conforme seu esquema de orgs/roles)
alter table public.model_pricing enable row level security;
-- Policies com checagem de existência (compatível com reruns)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'model_pricing' and policyname = 'model_pricing_read_all'
  ) then
    create policy model_pricing_read_all on public.model_pricing for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'model_pricing' and policyname = 'model_pricing_write_org'
  ) then
    create policy model_pricing_write_org on public.model_pricing for insert to authenticated with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'model_pricing' and policyname = 'model_pricing_update_org'
  ) then
    create policy model_pricing_update_org on public.model_pricing for update to authenticated using (true) with check (true);
  end if;
end $$;

-- 2) Função utilitária para obter preço
create or replace function public.compute_cost_usd_db(
  p_provider text,
  p_model text,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_org uuid
) returns numeric language plpgsql as $$
begin
  -- Tenta preço por organização
  return coalesce((
    select ((p_prompt_tokens * mp.prompt_per_mtokens) + (p_completion_tokens * mp.completion_per_mtokens)) / 1000000.0
    from public.model_pricing mp
    where (mp.organization_id = p_org) and lower(mp.provider) = lower(p_provider) and lower(mp.model) = lower(p_model)
    limit 1
  ), (
    -- Tenta preço padrão (organization_id IS NULL)
    select ((p_prompt_tokens * mp.prompt_per_mtokens) + (p_completion_tokens * mp.completion_per_mtokens)) / 1000000.0
    from public.model_pricing mp
    where mp.organization_id is null and lower(mp.provider) = lower(p_provider) and lower(mp.model) = lower(p_model)
    limit 1
  ), (
    -- Fallbacks por provedor
    case lower(p_provider)
      when 'openai' then ((p_prompt_tokens * 5.0) + (p_completion_tokens * 15.0)) / 1000000.0 -- gpt-4o baseline
      when 'anthropic' then ((p_prompt_tokens * 3.0) + (p_completion_tokens * 15.0)) / 1000000.0 -- claude-3.5 sonnet aprox.
      when 'google' then ((p_prompt_tokens * 3.5) + (p_completion_tokens * 10.5)) / 1000000.0 -- gemini 1.5 pro aprox.
      when 'perplexity' then ((p_prompt_tokens * 1.0) + (p_completion_tokens * 1.0)) / 1000000.0 -- estimativa básica
      else ((p_prompt_tokens * 5.0) + (p_completion_tokens * 15.0)) / 1000000.0
    end
  ));
end;$$;

-- 3) RPC para recalcular custos
create or replace function public.recalc_costs(
  p_org uuid,
  p_provider text default null
) returns void language plpgsql security definer as $$
begin
  -- OpenAI
  if p_provider is null or lower(p_provider) = 'openai' then
    update public.agent_token_usage u
    set cost_usd = public.compute_cost_usd_db('openai', coalesce(u.model,''), coalesce(u.prompt_tokens,0), coalesce(u.completion_tokens,0), p_org)
    where u.organization_id = p_org
      and lower(coalesce(u.provider,'')) = 'openai'
      and coalesce(u.total_tokens,0) > 0
      and (coalesce(u.cost_usd,0) = 0);
  end if;

  -- Anthropic
  if p_provider is null or lower(p_provider) = 'anthropic' then
    update public.agent_token_usage u
    set cost_usd = public.compute_cost_usd_db('anthropic', coalesce(u.model,''), coalesce(u.prompt_tokens,0), coalesce(u.completion_tokens,0), p_org)
    where u.organization_id = p_org
      and lower(coalesce(u.provider,'')) = 'anthropic'
      and coalesce(u.total_tokens,0) > 0
      and (coalesce(u.cost_usd,0) = 0);
  end if;

  -- Google (Gemini) – estimado
  if p_provider is null or lower(p_provider) = 'google' then
    update public.agent_token_usage u
    set cost_usd = public.compute_cost_usd_db('google', coalesce(u.model,''), coalesce(u.prompt_tokens,0), coalesce(u.completion_tokens,0), p_org),
        cost_estimated = true
    where u.organization_id = p_org
      and lower(coalesce(u.provider,'')) = 'google'
      and coalesce(u.total_tokens,0) > 0
      and (coalesce(u.cost_usd,0) = 0 or u.cost_estimated is distinct from true);
  end if;

  -- Perplexity – estimado
  if p_provider is null or lower(p_provider) = 'perplexity' then
    update public.agent_token_usage u
    set cost_usd = public.compute_cost_usd_db('perplexity', coalesce(u.model,''), coalesce(u.prompt_tokens,0), coalesce(u.completion_tokens,0), p_org),
        cost_estimated = true
    where u.organization_id = p_org
      and lower(coalesce(u.provider,'')) = 'perplexity'
      and coalesce(u.total_tokens,0) > 0
      and (coalesce(u.cost_usd,0) = 0 or u.cost_estimated is distinct from true);
  end if;
end;$$;

commit;

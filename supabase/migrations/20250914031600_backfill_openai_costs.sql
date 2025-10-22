-- Backfill cost_usd for OpenAI records in public.agent_token_usage
-- Uses approximate pricing per 1M tokens based on model id heuristics
-- Only updates rows with provider='openai', total_tokens>0 and cost_usd=0

with rates as (
  select 'gpt-4o'::text as key, 5.0::numeric as prompt_per_m, 15.0::numeric as completion_per_m union all
  select 'gpt-4o-mini', 0.5, 1.5 union all
  select 'gpt-4-turbo', 10.0, 30.0 union all
  select 'gpt-4.1', 5.0, 15.0 union all
  select 'gpt-4.1-mini', 3.0, 15.0 union all
  select 'gpt-3.5-turbo', 0.5, 1.5
),
-- Map model -> rate key using simple heuristics (lowercased match/contains)
model_rate as (
  select
    u.id,
    u.model,
    case
      when lower(coalesce(u.model,'')) like '%gpt-4o-mini%' then 'gpt-4o-mini'
      when lower(coalesce(u.model,'')) like '%gpt-4o%' then 'gpt-4o'
      when lower(coalesce(u.model,'')) like '%gpt-4-turbo%' then 'gpt-4-turbo'
      when lower(coalesce(u.model,'')) like '%gpt-4.1-mini%' then 'gpt-4.1-mini'
      when lower(coalesce(u.model,'')) like '%gpt-4.1%' then 'gpt-4.1'
      when lower(coalesce(u.model,'')) like '%gpt-3.5-turbo%' then 'gpt-3.5-turbo'
      else 'gpt-4o-mini' -- fallback
    end as rate_key
  from public.agent_token_usage u
  where u.provider = 'openai'
    and coalesce(u.total_tokens,0) > 0
    and coalesce(u.cost_usd,0) = 0
)
update public.agent_token_usage as u
set cost_usd = round(((u.prompt_tokens * r.prompt_per_m) + (u.completion_tokens * r.completion_per_m)) / 1000000.0, 6)
from model_rate mr
join rates r on r.key = mr.rate_key
where u.id = mr.id;

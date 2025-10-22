-- Count rows for list_chat_history_by_day with same filters
create or replace function public.list_chat_history_by_day_count(
  p_org uuid,
  p_from date default null,
  p_to date default null,
  p_agent uuid default null,
  p_q text default null,
  p_status text default null
)
returns bigint
language sql
stable
set search_path = public
as $$
  with msgs as (
    select m.id, m.agent_id, m.user_id, m.role, m.content, m.created_at
    from public.agent_messages m
    join public.agents a on a.id = m.agent_id
    where a.organization_id = p_org
      and (p_agent is null or m.agent_id = p_agent)
      and (p_from is null or m.created_at >= (p_from::timestamptz))
      and (p_to is null or m.created_at < ((p_to + 1)::timestamptz))
      and (p_q is null or m.content ilike '%' || p_q || '%')
  ), agg as (
    select date_trunc('day', created_at)::date as day,
           agent_id,
           max(created_at) as last_time
    from msgs
    group by 1,2
  )
  select count(*)::bigint
  from agg a
  where (p_status is null or lower(p_status) = lower(case when now() - a.last_time < interval '30 minutes' then 'active' else 'completed' end));
$$;

revoke all on function public.list_chat_history_by_day_count(uuid, date, date, uuid, text, text) from public, anon;
grant execute on function public.list_chat_history_by_day_count(uuid, date, date, uuid, text, text) to authenticated;

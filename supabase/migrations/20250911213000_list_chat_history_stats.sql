-- Stats for chat history by day given filters
create or replace function public.list_chat_history_stats(
  p_org uuid,
  p_from date default null,
  p_to date default null,
  p_agent uuid default null,
  p_q text default null,
  p_status text default null
)
returns table (
  total_count bigint,
  active_count bigint,
  completed_count bigint,
  avg_duration_seconds numeric
)
language sql
stable
set search_path = public
as $$
  with msgs as (
    select m.id, m.agent_id, m.content, m.created_at
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
           min(created_at) as first_time,
           max(created_at) as last_time
    from msgs
    group by 1,2
  ), typed as (
    select day,
           agent_id,
           first_time,
           last_time,
           case when now() - last_time < interval '30 minutes' then 'active' else 'completed' end as status,
           extract(epoch from (last_time - first_time)) as duration_seconds
    from agg
  )
  select
    count(*)::bigint as total_count,
    count(*) filter (where status = 'active')::bigint as active_count,
    count(*) filter (where status = 'completed')::bigint as completed_count,
    avg(duration_seconds)::numeric as avg_duration_seconds
  from typed
  where (p_status is null or lower(p_status) = lower(status));
$$;

revoke all on function public.list_chat_history_stats(uuid, date, date, uuid, text, text) from public, anon;
grant execute on function public.list_chat_history_stats(uuid, date, date, uuid, text, text) to authenticated;

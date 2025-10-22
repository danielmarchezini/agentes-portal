-- Aggregated chat history by day per agent for an organization
-- Filters: date range, agent, free text q on content, status (active/completed) post-filter
-- Returns paginated rows ordered by day desc, last_time desc
create or replace function public.list_chat_history_by_day(
  p_org uuid,
  p_from date default null,
  p_to date default null,
  p_agent uuid default null,
  p_q text default null,
  p_status text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  day date,
  agent_id uuid,
  agent_name text,
  message_count int,
  first_time timestamptz,
  last_time timestamptz,
  last_message text,
  status text
)
language sql
stable
set search_path = public
as $$
  with msgs as (
    select m.id, m.agent_id, m.user_id, m.role, m.content, m.created_at, a.name as agent_name
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
           max(created_at) as last_time,
           min(created_at) as first_time,
           count(*) as message_count,
           max(agent_name) as agent_name
    from msgs
    group by 1,2
  ), last_msg as (
    select date_trunc('day', m.created_at)::date as day,
           m.agent_id,
           m.content,
           row_number() over (partition by date_trunc('day', m.created_at)::date, m.agent_id order by m.created_at desc) as rn
    from msgs m
  )
  select a.day,
         a.agent_id,
         a.agent_name,
         a.message_count,
         a.first_time,
         a.last_time,
         coalesce(l.content, '') as last_message,
         case when now() - a.last_time < interval '30 minutes' then 'active' else 'completed' end as status
  from agg a
  left join last_msg l on l.day = a.day and l.agent_id = a.agent_id and l.rn = 1
  where (p_status is null or lower(p_status) = lower(case when now() - a.last_time < interval '30 minutes' then 'active' else 'completed' end))
  order by a.day desc, a.last_time desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

-- Permissions: allow authenticated users to execute (RLS should enforce org access at app layer)
revoke all on function public.list_chat_history_by_day(uuid, date, date, uuid, text, text, int, int) from public, anon;
grant execute on function public.list_chat_history_by_day(uuid, date, date, uuid, text, text, int, int) to authenticated;

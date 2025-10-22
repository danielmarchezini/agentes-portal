create or replace function public.increment_agent_usage(agent_id_input uuid)
returns void as $$
begin
  update public.agents
  set usage_count = usage_count + 1
  where id = agent_id_input;
end;
$$ language plpgsql;

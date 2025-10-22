-- Helper RPC to accept float array and cast to vector for search
create or replace function public.rag_search_array(
  p_agent uuid,
  p_query float4[],
  p_k integer default 5
)
returns table(
  document_id uuid,
  chunk_index integer,
  content text,
  distance real
) language sql stable as $$
  select c.document_id, c.chunk_index, c.content, (c.embedding <#> (p_query::vector(1536)))::real as distance
  from public.rag_chunks c
  where c.agent_id = p_agent
  order by c.embedding <#> (p_query::vector(1536))
  limit p_k;
$$;

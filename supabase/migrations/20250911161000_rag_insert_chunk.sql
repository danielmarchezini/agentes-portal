-- RPC to insert a chunk with embedding array (float4[] cast to vector)
create or replace function public.rag_insert_chunk(
  p_document_id uuid,
  p_agent_id uuid,
  p_chunk_index integer,
  p_content text,
  p_embedding float4[]
) returns void
language plpgsql as $$
begin
  insert into public.rag_chunks(document_id, agent_id, chunk_index, content, embedding)
  values (p_document_id, p_agent_id, p_chunk_index, p_content, p_embedding::vector(1536));
end;
$$;

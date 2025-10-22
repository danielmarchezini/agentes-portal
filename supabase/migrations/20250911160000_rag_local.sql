-- Enable pgvector and create RAG tables
create extension if not exists vector;

create table if not exists public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete cascade,
  filename text not null,
  mime_type text,
  file_size integer,
  created_at timestamptz not null default now()
);

-- Use 1536 dims to match text-embedding-3-small (adjust if using another model)
create table if not exists public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.rag_documents(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists rag_chunks_doc_idx on public.rag_chunks(document_id);
create index if not exists rag_chunks_agent_idx on public.rag_chunks(agent_id);
-- For cosine distance search
create index if not exists rag_chunks_embedding_idx on public.rag_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Search function: returns top-K chunks for an agent by embedding similarity
create or replace function public.rag_search(
  p_agent uuid,
  p_query vector(1536),
  p_k integer default 5
)
returns table(
  document_id uuid,
  chunk_index integer,
  content text,
  distance real
) language sql stable as $$
  select c.document_id, c.chunk_index, c.content, (c.embedding <#> p_query)::real as distance
  from public.rag_chunks c
  where c.agent_id = p_agent
  order by c.embedding <#> p_query
  limit p_k;
$$;

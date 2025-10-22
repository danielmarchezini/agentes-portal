-- Add optional provider/model fields to agents for RAG embeddings and generation
alter table public.agents
  add column if not exists embedding_provider text check (embedding_provider in ('openai','ollama')),
  add column if not exists embedding_model text,
  add column if not exists generation_provider text check (generation_provider in ('openai','anthropic','google','perplexity','ollama'));

-- No data backfill required; defaults will be handled in application code.

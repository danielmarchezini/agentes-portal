-- Per-agent file upload options
alter table if exists public.agents
  add column if not exists allow_file_uploads boolean default false,
  add column if not exists file_storage_mode text check (file_storage_mode in ('openai_vector_store','local_rag')) default 'openai_vector_store',
  add column if not exists rag_collection_id text;

create index if not exists agents_file_storage_mode_idx on public.agents(file_storage_mode);

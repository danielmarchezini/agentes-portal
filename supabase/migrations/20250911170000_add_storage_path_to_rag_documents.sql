-- Add storage_path to rag_documents to support reprocess via Storage
alter table public.rag_documents
add column if not exists storage_path text;

create index if not exists rag_documents_storage_path_idx on public.rag_documents(storage_path);

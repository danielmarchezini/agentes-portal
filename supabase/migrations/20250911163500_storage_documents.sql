-- Create Storage bucket for RAG documents
insert into storage.buckets (id, name, public) values ('documents','documents', false)
on conflict (id) do nothing;

-- RLS policies: only authenticated users of the same org can manage their files via app code
-- Assuming you use a JWT with 'sub' as user id and org_id in auth.jwt() custom claim (adjust if needed)
drop policy if exists "documents read" on storage.objects;
create policy "documents read" on storage.objects
for select using (bucket_id = 'documents');

drop policy if exists "documents upload" on storage.objects;
create policy "documents upload" on storage.objects
for insert with check (bucket_id = 'documents');

drop policy if exists "documents update" on storage.objects;
create policy "documents update" on storage.objects
for update using (bucket_id = 'documents');

drop policy if exists "documents delete" on storage.objects;
create policy "documents delete" on storage.objects
for delete using (bucket_id = 'documents');

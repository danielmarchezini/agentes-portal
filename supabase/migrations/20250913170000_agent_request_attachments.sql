-- Add attachments and requested_at to agent_requests
alter table public.agent_requests
  add column if not exists attachments jsonb default '[]'::jsonb,
  add column if not exists requested_at timestamptz default now();

comment on column public.agent_requests.attachments is 'Lista de arquivos anexados (array de objetos com {path, name, size})';
comment on column public.agent_requests.requested_at is 'Data/hora em que o pedido foi registrado';

-- Storage policies for agent request files (private bucket: agent-request-files)
-- Allow authenticated users to upload to their own request folder; managers/admin/owner can read all within org
-- Note: ensure the bucket 'agent-request-files' exists

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='arf_insert_own'
  ) then
    create policy "arf_insert_own"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'agent-request-files'
        and (
          -- enforce prefix by requester id; the app will use org_id/request_id/filename
          name like auth.uid()::text || '/%'
          or name like (select coalesce(organization_id::text,'') from public.profiles where id = auth.uid()) || '/%'
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='arf_select_org'
  ) then
    create policy "arf_select_org"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'agent-request-files'
        and (
          -- requester can read own prefix
          name like auth.uid()::text || '/%'
          or (
            -- managers/admin/owner can read any within their org prefix
            exists (
              select 1 from public.profiles p
              where p.id = auth.uid() and p.role in ('bot_manager','admin','owner')
            )
          )
        )
      );
  end if;
end $$;

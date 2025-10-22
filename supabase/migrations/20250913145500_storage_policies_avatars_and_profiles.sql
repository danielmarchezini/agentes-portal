-- Storage policies for private avatars bucket and self-service profile access
-- Bucket: avatars (private). Objects path convention: <user_id>/<filename>

-- Allow authenticated users to INSERT (upload) into avatars bucket only within their own folder
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatar_upload_own_folder'
  ) then
    create policy "avatar_upload_own_folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'avatars'
        and (name like auth.uid()::text || '/%')
      );
  end if;
end $$;

-- Allow authenticated users to SELECT (list/metadata and generate signed urls) only their own objects in avatars bucket
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatar_select_own_folder'
  ) then
    create policy "avatar_select_own_folder"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'avatars'
        and (name like auth.uid()::text || '/%')
      );
  end if;
end $$;

-- Optionally allow DELETE of own avatar objects (if you expose delete in UI)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatar_delete_own_folder'
  ) then
    create policy "avatar_delete_own_folder"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'avatars'
        and (name like auth.uid()::text || '/%')
      );
  end if;
end $$;

-- Profiles RLS: allow user to SELECT their own profile and UPDATE their own avatar/name
alter table if exists public.profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_self_select'
  ) then
    create policy "profiles_self_select"
      on public.profiles for select
      to authenticated
      using (id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_self_update'
  ) then
    create policy "profiles_self_update"
      on public.profiles for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end $$;

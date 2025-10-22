-- Storage policies for bucket: agent-request-files
-- Path convention: <organization_id>/<user_id>/<random>.<ext>
-- This script will create the bucket if it does not exist and set RLS policies

-- 1) Create bucket (idempotent)
DO $$ BEGIN
  PERFORM 1 FROM storage.buckets WHERE id = 'agent-request-files';
  IF NOT FOUND THEN
    PERFORM storage.create_bucket('agent-request-files', jsonb_build_object(
      'public', false,
      'file_size_limit', 52428800 -- 50 MB
    ));
  END IF;
END $$;

-- 2) Enable RLS on storage.objects (it is always enabled, but policies are per-bucket)
-- Policies are evaluated on storage.objects with bucket_id and name

-- Helper notes:
-- split_part(name, '/', 1) => organization_id segment
-- split_part(name, '/', 2) => user_id segment

-- SELECT: owner of the file OR admins/owners/bot_managers of the same organization can read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'arf_select_owner_or_admins'
  ) THEN
    CREATE POLICY arf_select_owner_or_admins ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'agent-request-files'
        AND (
          -- owner (2nd segment == auth.uid())
          split_part(name, '/', 2) = auth.uid()::text
          OR (
            -- admins/owners/bot_managers from same org (1st segment == user org)
            split_part(name, '/', 1) = (
              SELECT p.organization_id::text FROM public.profiles p WHERE p.id = auth.uid()
            )
            AND EXISTS (
              SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','owner','bot_manager')
            )
          )
        )
      );
  END IF;
END $$;

-- INSERT: authenticated users may upload only into their own org/user folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'arf_insert_own_folder'
  ) THEN
    CREATE POLICY arf_insert_own_folder ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'agent-request-files'
        AND split_part(name, '/', 1) = (
          SELECT p.organization_id::text FROM public.profiles p WHERE p.id = auth.uid()
        )
        AND split_part(name, '/', 2) = auth.uid()::text
      );
  END IF;
END $$;

-- DELETE: owner (uploader) can delete; admins/owners can delete within the same org
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'arf_delete_owner_or_admins'
  ) THEN
    CREATE POLICY arf_delete_owner_or_admins ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'agent-request-files'
        AND (
          split_part(name, '/', 2) = auth.uid()::text
          OR (
            split_part(name, '/', 1) = (
              SELECT p.organization_id::text FROM public.profiles p WHERE p.id = auth.uid()
            )
            AND EXISTS (
              SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','owner')
            )
          )
        )
      );
  END IF;
END $$;

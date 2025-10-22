-- Backfill and cleanup to satisfy FKs to public.user_groups
-- 1) If legacy public.groups exists, backfill missing rows into public.user_groups
-- 2) Remove orphans in group_members and agent_shares before (re)adding FKs

DO $$
BEGIN
  -- Backfill from legacy public.groups if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'groups'
  ) THEN
    INSERT INTO public.user_groups (id, organization_id, name, description, created_by, created_at)
    SELECT g.id, g.organization_id,
           COALESCE(NULLIF(g.name, ''), 'Grupo Migrado'),
           g.description,
           g.created_by,
           COALESCE(g.created_at, now())
    FROM public.groups g
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_groups ug WHERE ug.id = g.id
    );
  END IF;

  -- Remove orphans in group_members (rows whose group_id does not exist in user_groups)
  DELETE FROM public.group_members gm
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_groups ug WHERE ug.id = gm.group_id
  );

  -- Remove orphans in agent_shares for group target
  DELETE FROM public.agent_shares s
  WHERE s.target_type = 'group'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_groups ug WHERE ug.id = s.target_group_id
    );
END $$;

-- Recreate FKs safely after cleanup
DO $$
BEGIN
  -- group_members -> user_groups
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'group_members' AND constraint_name = 'group_members_group_id_fkey'
  ) THEN
    ALTER TABLE public.group_members DROP CONSTRAINT group_members_group_id_fkey;
  END IF;
  ALTER TABLE public.group_members
    ADD CONSTRAINT group_members_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES public.user_groups(id) ON DELETE CASCADE;

  -- agent_shares.target_group_id -> user_groups
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'agent_shares' AND constraint_name = 'agent_shares_target_group_fk'
  ) THEN
    ALTER TABLE public.agent_shares DROP CONSTRAINT agent_shares_target_group_fk;
  END IF;
  ALTER TABLE public.agent_shares
    ADD CONSTRAINT agent_shares_target_group_fk
    FOREIGN KEY (target_group_id) REFERENCES public.user_groups(id) ON DELETE CASCADE;
END $$;

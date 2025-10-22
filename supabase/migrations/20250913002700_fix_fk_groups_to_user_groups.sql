-- Corrige FKs que ainda apontavam para public.groups em vez de public.user_groups
-- Nesta migration, apenas removemos as FKs antigas. A recriação segura ocorre na
-- migration seguinte: 20250913002900_backfill_groups_and_fix_orphans.sql

-- group_members: garantir FK para user_groups
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'group_members_group_id_fkey'
      AND table_name = 'group_members'
  ) THEN
    ALTER TABLE public.group_members DROP CONSTRAINT group_members_group_id_fkey;
  END IF;
END $$;

-- FK será recriada na próxima migration

-- agent_shares: garantir FK target_group_id -> user_groups.id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'agent_shares_target_group_fk'
      AND table_name = 'agent_shares'
  ) THEN
    ALTER TABLE public.agent_shares DROP CONSTRAINT agent_shares_target_group_fk;
  END IF;
END $$;

-- FK será recriada na próxima migration

-- Agent Collections & Collection Shares
-- This migration introduces agent collections to enable sharing agents in bulk with users and groups.

-- 1) Create enums if they do not exist (share_scope, share_permission)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'share_scope') THEN
    CREATE TYPE share_scope AS ENUM ('public', 'user', 'group');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'share_permission') THEN
    CREATE TYPE share_permission AS ENUM ('view', 'chat', 'edit', 'admin');
  END IF;
END $$;

-- 1.5) User groups (required for group-based sharing)
CREATE TABLE IF NOT EXISTS public.user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_groups_org_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_groups_org ON public.user_groups(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_group_member UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);

ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Policies for user_groups
DROP POLICY IF EXISTS user_groups_select ON public.user_groups;
DROP POLICY IF EXISTS user_groups_modify ON public.user_groups;

CREATE POLICY user_groups_select ON public.user_groups
FOR SELECT TO authenticated
USING (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
  OR public.is_system_owner()
);

CREATE POLICY user_groups_modify ON public.user_groups
FOR ALL TO authenticated
USING (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
  AND (
    public.is_system_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
    )
  )
) WITH CHECK (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
);

-- Policies for group_members
DROP POLICY IF EXISTS group_members_select ON public.group_members;
DROP POLICY IF EXISTS group_members_modify ON public.group_members;

CREATE POLICY group_members_select ON public.group_members
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_groups ug
    WHERE ug.id = group_members.group_id
      AND (
        ug.organization_id IS NOT DISTINCT FROM (
          SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
        )
        OR public.is_system_owner()
      )
  )
);

CREATE POLICY group_members_modify ON public.group_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_groups ug
    WHERE ug.id = group_members.group_id
      AND ug.organization_id IS NOT DISTINCT FROM (
        SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
      )
  ) AND (
    public.is_system_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_groups ug
    WHERE ug.id = group_members.group_id
      AND ug.organization_id IS NOT DISTINCT FROM (
        SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
      )
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;

-- 2) Tables: agent_collections, agent_collection_items, collection_shares
CREATE TABLE IF NOT EXISTS public.agent_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_agent_collections_org_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_agent_collections_org_created ON public.agent_collections(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.agent_collections(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_agent_collection_item UNIQUE (collection_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_items_org_coll ON public.agent_collection_items(organization_id, collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_org_agent ON public.agent_collection_items(organization_id, agent_id);

CREATE TABLE IF NOT EXISTS public.collection_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.agent_collections(id) ON DELETE CASCADE,
  scope_type share_scope NOT NULL,
  scope_id uuid NULL,
  permission share_permission NOT NULL DEFAULT 'view',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_collection_scope UNIQUE (collection_id, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_shares_org_coll ON public.collection_shares(organization_id, collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_shares_scope ON public.collection_shares(scope_type, scope_id);

-- 3) Triggers to maintain updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS set_updated_at_on_agent_collections ON public.agent_collections;
CREATE TRIGGER set_updated_at_on_agent_collections
BEFORE UPDATE ON public.agent_collections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) RLS: enable and policies
ALTER TABLE public.agent_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_shares ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is a system owner
CREATE OR REPLACE FUNCTION public.is_system_owner()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_owners so
    WHERE lower(so.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
$$;

-- Helper: get current user's organization id
CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1;
$$;

-- agent_collections policies
DROP POLICY IF EXISTS agent_collections_select ON public.agent_collections;
DROP POLICY IF EXISTS agent_collections_modify ON public.agent_collections;

CREATE POLICY agent_collections_select ON public.agent_collections
FOR SELECT TO authenticated
USING (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
  OR public.is_system_owner()
);

CREATE POLICY agent_collections_modify ON public.agent_collections
FOR ALL TO authenticated
USING (
  (
    organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
    )
    AND (
      public.is_system_owner()
      OR EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
      )
    )
  )
) WITH CHECK (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
);

-- agent_collection_items policies
DROP POLICY IF EXISTS collection_items_select ON public.agent_collection_items;
DROP POLICY IF EXISTS collection_items_modify ON public.agent_collection_items;

CREATE POLICY collection_items_select ON public.agent_collection_items
FOR SELECT TO authenticated
USING (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
  OR public.is_system_owner()
);

CREATE POLICY collection_items_modify ON public.agent_collection_items
FOR ALL TO authenticated
USING (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
  AND (
    public.is_system_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
    )
  )
) WITH CHECK (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
);

-- collection_shares policies
DROP POLICY IF EXISTS collection_shares_select ON public.collection_shares;
DROP POLICY IF EXISTS collection_shares_modify ON public.collection_shares;

CREATE POLICY collection_shares_select ON public.collection_shares
FOR SELECT TO authenticated
USING (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
  OR public.is_system_owner()
);

CREATE POLICY collection_shares_modify ON public.collection_shares
FOR ALL TO authenticated
USING (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
  AND (
    public.is_system_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
    )
  )
) WITH CHECK (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_collection_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_shares TO authenticated;

-- 5) Permission helpers
CREATE OR REPLACE FUNCTION public.permission_rank(p share_permission)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p
    WHEN 'view' THEN 1
    WHEN 'chat' THEN 2
    WHEN 'edit' THEN 3
    WHEN 'admin' THEN 4
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.max_permission(p1 share_permission, p2 share_permission)
RETURNS share_permission LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN public.permission_rank(p1) >= public.permission_rank(p2) THEN p1 ELSE p2 END;
$$;

-- 6) Effective permission for a collection
-- Assumes existence of user groups tables: user_groups(id, organization_id, name), group_members(group_id, user_id)
CREATE OR REPLACE FUNCTION public.collection_effective_permission(p_org uuid, p_collection uuid)
RETURNS share_permission LANGUAGE plpgsql STABLE AS $$
DECLARE
  perm share_permission := 'view';
  has_any boolean := false;
BEGIN
  IF public.is_system_owner() THEN
    RETURN 'admin';
  END IF;

  -- Public
  SELECT cs.permission INTO perm
  FROM public.collection_shares cs
  WHERE cs.organization_id = p_org AND cs.collection_id = p_collection AND cs.scope_type = 'public'
  ORDER BY permission_rank(cs.permission) DESC
  LIMIT 1;
  IF FOUND THEN
    has_any := true;
  END IF;

  -- User direct
  PERFORM 1 FROM public.collection_shares cs
  WHERE cs.organization_id = p_org AND cs.collection_id = p_collection AND cs.scope_type = 'user' AND cs.scope_id = auth.uid();
  IF FOUND THEN
    SELECT public.max_permission(perm, cs.permission) INTO perm
    FROM public.collection_shares cs
    WHERE cs.organization_id = p_org AND cs.collection_id = p_collection AND cs.scope_type = 'user' AND cs.scope_id = auth.uid()
    ORDER BY permission_rank(cs.permission) DESC LIMIT 1;
    has_any := true;
  END IF;

  -- Via groups
  WITH my_groups AS (
    SELECT gm.group_id
    FROM public.group_members gm
    JOIN public.user_groups ug ON ug.id = gm.group_id
    WHERE gm.user_id = auth.uid() AND ug.organization_id = p_org
  )
  SELECT public.max_permission(perm, max(cs.permission)) INTO perm
  FROM public.collection_shares cs
  JOIN my_groups g ON cs.scope_type = 'group' AND cs.scope_id = g.group_id
  WHERE cs.organization_id = p_org AND cs.collection_id = p_collection;

  IF perm IS NULL AND has_any IS FALSE THEN
    RETURN 'view'; -- default no-access marker won't be used; caller should treat missing permission as 'none'. But we stick to 'view' fallback for stability.
  END IF;
  RETURN perm;
END;
$$;

-- 7) Extend agent effective permission to include collections
-- Note: Keep return type as text for backward compatibility with existing callers.
-- Drop existing function first to allow changing return type if needed
DROP FUNCTION IF EXISTS public.agent_effective_permission(uuid, uuid);
CREATE FUNCTION public.agent_effective_permission(p_org uuid, p_agent uuid)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
  perm share_permission := NULL;
  direct share_permission := NULL;
  via_col share_permission := NULL;
BEGIN
  IF public.is_system_owner() THEN
    RETURN 'admin';
  END IF;

  -- Direct agent shares
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  my_groups AS (
    SELECT gm.group_id
    FROM public.group_members gm
    JOIN public.user_groups ug ON ug.id = gm.group_id
    WHERE gm.user_id = auth.uid() AND ug.organization_id = p_org
  ),
  direct_perms AS (
    SELECT as1.permission
    FROM public.agent_shares as1
    WHERE as1.organization_id = p_org AND as1.agent_id = p_agent AND (
      as1.target_type = 'public'
      OR (as1.target_type = 'user' AND as1.target_user_id = (SELECT uid FROM me))
      OR (as1.target_type = 'group' AND as1.target_group_id IN (SELECT group_id FROM my_groups))
    )
    ORDER BY permission_rank(as1.permission) DESC
    LIMIT 1
  )
  SELECT dp.permission INTO direct FROM direct_perms dp LIMIT 1;

  -- Via collections
  WITH agent_cols AS (
    SELECT aci.collection_id
    FROM public.agent_collection_items aci
    WHERE aci.organization_id = p_org AND aci.agent_id = p_agent
  ),
  col_perms AS (
    SELECT cs.permission
    FROM public.collection_shares cs
    JOIN agent_cols c ON c.collection_id = cs.collection_id
    WHERE cs.organization_id = p_org AND (
      cs.scope_type = 'public'
      OR (cs.scope_type = 'user' AND cs.scope_id = auth.uid())
      OR (cs.scope_type = 'group' AND cs.scope_id IN (
        SELECT gm.group_id
        FROM public.group_members gm
        JOIN public.user_groups ug ON ug.id = gm.group_id
        WHERE gm.user_id = auth.uid() AND ug.organization_id = p_org
      ))
    )
    ORDER BY permission_rank(cs.permission) DESC
    LIMIT 1
  )
  SELECT cp.permission INTO via_col FROM col_perms cp LIMIT 1;

  IF direct IS NULL AND via_col IS NULL THEN
    RETURN 'view'; -- fallback textual value
  END IF;

  IF direct IS NULL THEN
    RETURN via_col::text;
  ELSIF via_col IS NULL THEN
    RETURN direct::text;
  ELSE
    RETURN public.max_permission(direct, via_col)::text;
  END IF;
END;
$$;

-- 8) List accessible agents by minimal permission
CREATE OR REPLACE FUNCTION public.list_accessible_agents(p_org uuid, p_min_perm share_permission)
RETURNS TABLE(agent_id uuid, permission share_permission) LANGUAGE sql STABLE AS $$
  WITH ranked AS (
    SELECT a.id AS agent_id,
      MAX(public.permission_rank(perm)) AS pr
    FROM public.agents a
    LEFT JOIN LATERAL (
      SELECT (as1.permission)::share_permission AS perm
      FROM public.agent_shares as1
      WHERE as1.organization_id = p_org AND as1.agent_id = a.id AND (
        as1.target_type = 'public'
        OR (as1.target_type = 'user' AND as1.target_user_id = auth.uid())
        OR (as1.target_type = 'group' AND as1.target_group_id IN (
          SELECT gm.group_id
          FROM public.group_members gm
          JOIN public.user_groups ug ON ug.id = gm.group_id
          WHERE gm.user_id = auth.uid() AND ug.organization_id = p_org
        ))
      )
      UNION ALL
      SELECT cs.permission AS perm
      FROM public.collection_shares cs
      JOIN public.agent_collection_items aci ON aci.collection_id = cs.collection_id AND aci.organization_id = p_org AND aci.agent_id = a.id
      WHERE cs.organization_id = p_org AND (
        cs.scope_type = 'public'
        OR (cs.scope_type = 'user' AND cs.scope_id = auth.uid())
        OR (cs.scope_type = 'group' AND cs.scope_id IN (
          SELECT gm.group_id
          FROM public.group_members gm
          JOIN public.user_groups ug ON ug.id = gm.group_id
          WHERE gm.user_id = auth.uid() AND ug.organization_id = p_org
        ))
      )
    ) s ON TRUE
    WHERE a.organization_id = p_org
    GROUP BY a.id
  )
  SELECT r.agent_id,
    CASE r.pr WHEN 4 THEN 'admin' WHEN 3 THEN 'edit' WHEN 2 THEN 'chat' WHEN 1 THEN 'view' ELSE 'view' END::share_permission AS permission
  FROM ranked r
  WHERE r.pr >= public.permission_rank(p_min_perm);
$$;

GRANT EXECUTE ON FUNCTION public.collection_effective_permission(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_effective_permission(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_accessible_agents(uuid, share_permission) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_system_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.permission_rank(share_permission) TO authenticated;
GRANT EXECUTE ON FUNCTION public.max_permission(share_permission, share_permission) TO authenticated;

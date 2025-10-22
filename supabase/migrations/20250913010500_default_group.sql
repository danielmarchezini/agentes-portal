-- Default group per organization: column, constraints, triggers and RPCs

-- 1) Schema changes: add is_default and unique constraint per org
ALTER TABLE public.user_groups
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- somente 1 grupo padrão por organização
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_groups_default_per_org
  ON public.user_groups(organization_id)
  WHERE is_default;

-- 2) Block deletion of default group
CREATE OR REPLACE FUNCTION public.prevent_delete_default_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_default IS TRUE THEN
    RAISE EXCEPTION 'cannot delete default group for the organization';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_default_group ON public.user_groups;
CREATE TRIGGER trg_prevent_delete_default_group
BEFORE DELETE ON public.user_groups
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_default_group();

-- 3) Auto-create default group when a new organization is created
CREATE OR REPLACE FUNCTION public.create_default_group_for_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_created_by boolean;
BEGIN
  -- se já existir um grupo padrão, não criar outro
  IF EXISTS (
    SELECT 1 FROM public.user_groups ug
    WHERE ug.organization_id = NEW.id AND ug.is_default
  ) THEN
    RETURN NEW;
  END IF;

  -- verificar se há coluna created_by em user_groups
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_groups' AND column_name = 'created_by'
  ) INTO has_created_by;

  IF has_created_by THEN
    INSERT INTO public.user_groups (organization_id, name, description, is_default, created_by)
    VALUES (NEW.id, 'Todos da organização', 'Grupo padrão com todos os usuários da organização', true, NULL)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_groups (organization_id, name, description, is_default)
    VALUES (NEW.id, 'Todos da organização', 'Grupo padrão com todos os usuários da organização', true)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_default_group_for_org ON public.organizations;
CREATE TRIGGER trg_create_default_group_for_org
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.create_default_group_for_org();

-- 4) Auto-join new users to the default group of their organization
CREATE OR REPLACE FUNCTION public.add_user_to_default_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
  has_created_by boolean;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ug.id INTO v_group
  FROM public.user_groups ug
  WHERE ug.organization_id = NEW.organization_id AND ug.is_default
  LIMIT 1;

  -- se não existir, cria e pega o id
  IF v_group IS NULL THEN
    INSERT INTO public.user_groups (organization_id, name, description, is_default)
    VALUES (NEW.organization_id, 'Todos da organização', 'Grupo padrão com todos os usuários da organização', true)
    RETURNING id INTO v_group;
  END IF;

  -- verificar se group_members tem coluna created_by
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'group_members' AND column_name = 'created_by'
  ) INTO has_created_by;

  IF has_created_by THEN
    INSERT INTO public.group_members (group_id, user_id, created_by)
    VALUES (v_group, NEW.id, NEW.id)
    ON CONFLICT (group_id, user_id) DO NOTHING;
  ELSE
    INSERT INTO public.group_members (group_id, user_id)
    VALUES (v_group, NEW.id)
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_user_to_default_group ON public.profiles;
CREATE TRIGGER trg_add_user_to_default_group
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.add_user_to_default_group();

-- 5) RPC to set/change default group for an organization
CREATE OR REPLACE FUNCTION public.set_org_default_group(p_org uuid, p_group uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- valida: grupo pertence à organização
  IF NOT EXISTS (
    SELECT 1 FROM public.user_groups g WHERE g.id = p_group AND g.organization_id = p_org
  ) THEN
    RAISE EXCEPTION 'group does not belong to organization';
  END IF;

  -- requer admin/owner da org ou system owner
  IF NOT (
    public.is_system_owner() OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.organization_id = p_org AND pr.role IN ('owner','admin')
    )
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.user_groups SET is_default = false WHERE organization_id = p_org;
  UPDATE public.user_groups SET is_default = true  WHERE id = p_group;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_org_default_group(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.set_org_default_group(uuid, uuid) TO authenticated;

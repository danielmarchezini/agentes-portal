-- Ajuste de políticas RLS para user_groups e group_members
-- Objetivo: permitir que qualquer usuário autenticado da organização liste grupos
-- e permitir que usuários não-admin criem/gerenciem grupos que eles mesmos criaram,
-- além de manter privilégios para admins e system owners.

-- user_groups
DROP POLICY IF EXISTS user_groups_select ON public.user_groups;
CREATE POLICY user_groups_select ON public.user_groups
FOR SELECT TO authenticated
USING (
  -- Mesma organização OU system owner
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
  OR public.is_system_owner()
);

DROP POLICY IF EXISTS user_groups_modify ON public.user_groups;
CREATE POLICY user_groups_modify ON public.user_groups
FOR ALL TO authenticated
USING (
  (
    organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
    )
  )
  AND (
    public.is_system_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
    )
    OR created_by = auth.uid() -- criador pode alterar/excluir seu próprio grupo
  )
) WITH CHECK (
  organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
  )
  AND (
    public.is_system_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
    )
    OR created_by = auth.uid() -- criador pode inserir/atualizar linhas próprias
  )
);

-- group_members
DROP POLICY IF EXISTS group_members_select ON public.group_members;
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

DROP POLICY IF EXISTS group_members_modify ON public.group_members;
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
    OR EXISTS (
      SELECT 1 FROM public.user_groups ug2
      WHERE ug2.id = group_members.group_id AND ug2.created_by = auth.uid() -- criador do grupo pode gerenciar membros
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

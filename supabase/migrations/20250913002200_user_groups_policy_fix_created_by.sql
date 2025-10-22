-- Ajuste adicional de policy: permitir INSERT/UPDATE quando organization_id = org do criador
-- Isso evita depender exclusivamente de auth.uid() para checar a org durante a inserção

DROP POLICY IF EXISTS user_groups_modify ON public.user_groups;
CREATE POLICY user_groups_modify ON public.user_groups
FOR ALL TO authenticated
USING (
  (
    organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
    )
    OR organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = created_by LIMIT 1
    )
  )
  AND (
    public.is_system_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
    )
    OR created_by = auth.uid()
  )
) WITH CHECK (
  (
    organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
    )
    OR organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = created_by LIMIT 1
    )
  )
  AND (
    public.is_system_owner()
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
    )
    OR created_by = auth.uid()
  )
);

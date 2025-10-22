-- RLS adjustments for system owners (support mode) on collections
-- Applies to: agent_collections, agent_collection_items, collection_shares

-- agent_collections
DROP POLICY IF EXISTS agent_collections_modify ON public.agent_collections;
CREATE POLICY agent_collections_modify ON public.agent_collections
FOR ALL TO authenticated
USING (
  (
    (
      organization_id IS NOT DISTINCT FROM (
        SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
      )
      AND EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
      )
    )
    OR public.is_system_owner()
  )
) WITH CHECK (
  (
    organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
    )
  )
  OR public.is_system_owner()
);

-- agent_collection_items
DROP POLICY IF EXISTS collection_items_modify ON public.agent_collection_items;
CREATE POLICY collection_items_modify ON public.agent_collection_items
FOR ALL TO authenticated
USING (
  (
    organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
    )
    AND (
      public.is_system_owner() OR EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
      )
    )
  )
  OR public.is_system_owner()
) WITH CHECK (
  (
    organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
    )
  )
  OR public.is_system_owner()
);

-- collection_shares
DROP POLICY IF EXISTS collection_shares_modify ON public.collection_shares;
CREATE POLICY collection_shares_modify ON public.collection_shares
FOR ALL TO authenticated
USING (
  (
    organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
    )
    AND (
      public.is_system_owner() OR EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND pr.role IN ('owner','admin')
      )
    )
  )
  OR public.is_system_owner()
) WITH CHECK (
  (
    organization_id IS NOT DISTINCT FROM (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
    )
  )
  OR public.is_system_owner()
);

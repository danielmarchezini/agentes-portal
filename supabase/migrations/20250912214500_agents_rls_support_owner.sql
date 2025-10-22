-- Allow system owners to manage agents regardless of organization membership
-- Adds RLS policies for SELECT/INSERT/UPDATE/DELETE on public.agents for system owners

-- Defensive drops (idempotent)
DROP POLICY IF EXISTS "System owners can view agents (support)" ON public.agents;
DROP POLICY IF EXISTS "System owners can create agents (support)" ON public.agents;
DROP POLICY IF EXISTS "System owners can update agents (support)" ON public.agents;
DROP POLICY IF EXISTS "System owners can delete agents (support)" ON public.agents;

-- SELECT for system owners (support mode)
CREATE POLICY "System owners can view agents (support)" ON public.agents
FOR SELECT TO authenticated
USING (public.is_system_owner());

-- INSERT for system owners (support mode)
CREATE POLICY "System owners can create agents (support)" ON public.agents
FOR INSERT TO authenticated
WITH CHECK (public.is_system_owner());

-- UPDATE for system owners (support mode)
CREATE POLICY "System owners can update agents (support)" ON public.agents
FOR UPDATE TO authenticated
USING (public.is_system_owner());

-- DELETE for system owners (support mode)
CREATE POLICY "System owners can delete agents (support)" ON public.agents
FOR DELETE TO authenticated
USING (public.is_system_owner());

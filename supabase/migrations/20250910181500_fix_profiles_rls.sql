-- Fix RLS on profiles to avoid self-referential policy causing 500s
-- Create helper functions with SECURITY DEFINER to fetch current user's org and role

create or replace function public.current_user_org_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Allow public to execute (required by PostgREST)
grant execute on function public.current_user_org_id() to anon, authenticated, service_role;
grant execute on function public.current_user_role() to anon, authenticated, service_role;

-- Drop the previous org-wide view policy that referenced profiles recursively
drop policy if exists "Admins and owners can view profiles in their organization" on public.profiles;

-- Recreate an org-wide view policy using helper functions to avoid recursion
drop policy if exists "Admins and owners can view org profiles" on public.profiles;
create policy "Admins and owners can view org profiles"
  on public.profiles
  for select
  using (
    (id = auth.uid())
    or (
      organization_id = public.current_user_org_id()
      and public.current_user_role() in ('admin','owner')
    )
  );

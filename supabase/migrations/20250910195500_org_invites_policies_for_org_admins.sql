-- Allow org owners/admins to manage invites for their own organization

-- Read invites of own organization
drop policy if exists "org admins read invites" on public.organization_invited_admins;
create policy "org admins read invites" on public.organization_invited_admins
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = organization_id
        and p.role in ('owner','admin')
    ) or public.is_system_admin()
  );

-- Insert invites in own organization
drop policy if exists "org admins insert invites" on public.organization_invited_admins;
create policy "org admins insert invites" on public.organization_invited_admins
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = organization_id
        and p.role in ('owner','admin')
    ) or public.is_system_admin()
  );

-- Update invites in own organization
drop policy if exists "org admins update invites" on public.organization_invited_admins;
create policy "org admins update invites" on public.organization_invited_admins
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = organization_id
        and p.role in ('owner','admin')
    ) or public.is_system_admin()
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = organization_id
        and p.role in ('owner','admin')
    ) or public.is_system_admin()
  );

-- Delete invites in own organization
drop policy if exists "org admins delete invites" on public.organization_invited_admins;
create policy "org admins delete invites" on public.organization_invited_admins
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = organization_id
        and p.role in ('owner','admin')
    ) or public.is_system_admin()
  );

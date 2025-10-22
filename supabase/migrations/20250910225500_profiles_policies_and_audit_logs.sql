-- Policies to allow owners/admins to manage users within their organization
-- and audit logs (table + triggers) for key actions

-- ====== PROFILES RLS UPDATES ======
-- Allow owners/admins to update users (role/status) of the same organization.
-- Prevent non-owners from modifying owners.

-- Update policy (idempotent via drop/create)
drop policy if exists "org admins update profiles" on public.profiles;
create policy "org admins update profiles" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = public.profiles.organization_id
        and p.role in ('owner','admin')
    )
  ) with check (
    -- Same org constraint
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = public.profiles.organization_id
        and p.role in ('owner','admin')
    )
    -- Do not allow changing owners unless the actor is owner
    and (
      public.profiles.role <> 'owner'
      or exists (
        select 1 from public.profiles p2
        where p2.id = auth.uid() and p2.role = 'owner'
      )
    )
  );

-- ====== AUDIT LOGS ======
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  organization_id uuid,
  action text not null,
  entity text,
  entity_id uuid,
  details jsonb default '{}'::jsonb
);

create index if not exists audit_logs_org_idx on public.audit_logs(organization_id);
create index if not exists audit_logs_action_idx on public.audit_logs(action);

alter table public.audit_logs enable row level security;

-- Read policy: system admin full access, and org members can read their org logs
drop policy if exists "read own org audit logs" on public.audit_logs;
create policy "read own org audit logs" on public.audit_logs
  for select using (
    public.is_system_admin() or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.organization_id = public.audit_logs.organization_id
    )
  );

-- Insert policy: allow inserts from SECURITY DEFINER functions
-- We'll write via SECURITY DEFINER functions, so no broad insert policy is necessary.

-- Helper function to write audit entries
create or replace function public.log_audit(
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_org_id uuid,
  p_details jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs(action, entity, entity_id, organization_id, actor_id, details)
  values (p_action, p_entity, p_entity_id, p_org_id, auth.uid(), coalesce(p_details, '{}'::jsonb));
$$;

grant execute on function public.log_audit(text, text, uuid, uuid, jsonb) to anon, authenticated, service_role;

-- ====== TRIGGERS TO CAPTURE EVENTS ======
-- Log organization created
create or replace function public.tg_log_org_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_audit('organization_created', 'organizations', new.id, new.id, jsonb_build_object('name', new.name, 'domain', new.domain));
  return new;
end;
$$;

drop trigger if exists trg_log_org_created on public.organizations;
create trigger trg_log_org_created
  after insert on public.organizations
  for each row execute procedure public.tg_log_org_created();

-- Log invites created/deleted
create or replace function public.tg_log_invite_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_audit('invite_created', 'organization_invited_admins', new.id, new.organization_id, jsonb_build_object('email', new.email, 'role', new.role));
  return new;
end;
$$;

drop trigger if exists trg_log_invite_created on public.organization_invited_admins;
create trigger trg_log_invite_created
  after insert on public.organization_invited_admins
  for each row execute procedure public.tg_log_invite_created();

create or replace function public.tg_log_invite_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_audit('invite_deleted', 'organization_invited_admins', old.id, old.organization_id, jsonb_build_object('email', old.email, 'role', old.role));
  return old;
end;
$$;

drop trigger if exists trg_log_invite_deleted on public.organization_invited_admins;
create trigger trg_log_invite_deleted
  after delete on public.organization_invited_admins
  for each row execute procedure public.tg_log_invite_deleted();

-- Log profile role/status changes
create or replace function public.tg_log_profile_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if new.role is distinct from old.role then
    v_changes := v_changes || jsonb_build_object('old_role', old.role, 'new_role', new.role);
  end if;
  if new.status is distinct from old.status then
    v_changes := v_changes || jsonb_build_object('old_status', old.status, 'new_status', new.status);
  end if;
  if v_changes <> '{}'::jsonb then
    perform public.log_audit('profile_updated', 'profiles', new.id, coalesce(new.organization_id, old.organization_id), v_changes);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_profile_updated on public.profiles;
create trigger trg_log_profile_updated
  after update of role, status on public.profiles
  for each row execute procedure public.tg_log_profile_updated();

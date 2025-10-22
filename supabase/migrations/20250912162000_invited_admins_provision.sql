-- Provisiona profile admin ao criar convite em organization_invited_admins
-- Requisitos esperados de schema:
--   - Tabela public.profiles com colunas: id (uuid), email (text unique), role (text), organization_id (uuid), status (text)
--   - Tabela public.organization_invited_admins com colunas: id, organization_id, email, role

create or replace function public.handle_invited_admin_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Normaliza e-mail
  new.email := lower(trim(new.email));

  -- Se já existir profile com esse e-mail, apenas atualiza organização e role se necessário
  if exists(select 1 from public.profiles p where p.email = new.email) then
    update public.profiles
       set organization_id = coalesce(organization_id, new.organization_id),
           role = case when role in ('owner','admin') then role else coalesce(new.role, 'admin') end,
           status = coalesce(status, 'pending')
     where email = new.email;
  else
    -- Cria profile mínimo para esse e-mail com role admin e status pending
    insert into public.profiles (id, email, name, role, organization_id, status)
    values (gen_random_uuid(), new.email, split_part(new.email,'@',1), coalesce(new.role,'admin'), new.organization_id, 'pending');
  end if;

  return new;
end;$$;

-- Trigger: AFTER INSERT na tabela de convites
create or replace trigger trg_invited_admins_provision
after insert on public.organization_invited_admins
for each row
execute function public.handle_invited_admin_insert();

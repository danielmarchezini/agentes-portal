-- Corrige função is_member_of_group para usar public.group_members e ser resiliente quando a tabela não existir

create or replace function public.is_member_of_group(p_group uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_is_member boolean := false;
begin
  begin
    select exists(
      select 1 from public.group_members gm
      where gm.group_id = p_group and gm.user_id = auth.uid()
    ) into v_is_member;
  exception when undefined_table then
    -- Se a tabela ainda não existe (ordem de migrações), retorna false sem quebrar
    return false;
  end;
  return v_is_member;
end;
$$;

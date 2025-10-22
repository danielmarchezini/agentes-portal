-- Índices de performance para busca e memberships
-- Requer pg_trgm para acelerar ILIKE com GIN trigram

create extension if not exists pg_trgm with schema public;

-- Profiles: filtros por organização + buscas por nome/email
create index if not exists idx_profiles_org on public.profiles (organization_id);
-- Trigram nos campos de busca (case-insensitive)
create index if not exists idx_profiles_name_trgm on public.profiles using gin (lower(name) gin_trgm_ops);
create index if not exists idx_profiles_email_trgm on public.profiles using gin (lower(email) gin_trgm_ops);

-- Group members: lookups por grupo/usuário e unicidade
create index if not exists idx_group_members_group on public.group_members (group_id);
create index if not exists idx_group_members_user on public.group_members (user_id);
create unique index if not exists uq_group_members on public.group_members (group_id, user_id);

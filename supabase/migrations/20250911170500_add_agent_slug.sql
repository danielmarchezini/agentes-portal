-- Add slug column to agents and create unique index
alter table public.agents add column if not exists slug text;
create unique index if not exists agents_slug_unique on public.agents(slug);

-- Backfill slugs for existing agents (best-effort)
with base as (
  select id,
         lower(regexp_replace(coalesce(name,''), '[^a-zA-Z0-9]+', '-', 'g')) as base_slug
  from public.agents
), ranked as (
  select id,
         case when base_slug is null or base_slug = '' then id::text else trim(both '-' from base_slug) end as s,
         row_number() over (partition by case when base_slug is null or base_slug = '' then id::text else trim(both '-' from base_slug) end order by id) as rn
  from base
)
update public.agents a
set slug = case when r.rn = 1 then r.s else r.s || '-' || r.rn end
from ranked r
where a.id = r.id and (a.slug is null or a.slug = '');

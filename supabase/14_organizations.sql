-- PackLens multi-tenant: organizations + memberships + backfill Helios
-- Ejecutar en SQL Editor de Supabase.

-- ── Organizations ───────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  template_key text not null default 'packaging-helios',
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'Activo' check (status in ('Activo', 'Inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_slug_idx on public.organizations(slug);
create index if not exists organizations_status_idx on public.organizations(status);

-- ── Memberships (usuario ↔ org + rol en ese tenant) ─────────────────────────
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null,
  status text not null default 'Activo' check (status in ('Activo', 'Inactivo')),
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_org_idx on public.memberships(organization_id);

-- ── Seed Helios ─────────────────────────────────────────────────────────────
insert into public.organizations (id, slug, name, template_key, settings, status)
values (
  'a0000000-0000-4000-8000-000000000001',
  'helios',
  'Helios',
  'packaging-helios',
  '{}'::jsonb,
  'Activo'
)
on conflict (slug) do update set
  name = excluded.name,
  template_key = excluded.template_key,
  updated_at = now();

-- ── organization_id en tablas clave ─────────────────────────────────────────
alter table public.projects
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.invitations
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.agents
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

-- Backfill a Helios
update public.projects
set organization_id = 'a0000000-0000-4000-8000-000000000001'
where organization_id is null;

update public.invitations
set organization_id = 'a0000000-0000-4000-8000-000000000001'
where organization_id is null;

update public.agents
set organization_id = 'a0000000-0000-4000-8000-000000000001'
where organization_id is null;

-- Memberships desde users.role actual
insert into public.memberships (user_id, organization_id, role, status)
select u.id, 'a0000000-0000-4000-8000-000000000001', u.role, u.status
from public.users u
on conflict (user_id, organization_id) do update set
  role = excluded.role,
  status = excluded.status;

-- Índices y NOT NULL gradual (projects/agents deben tener org)
create index if not exists projects_organization_idx on public.projects(organization_id);
create index if not exists invitations_organization_idx on public.invitations(organization_id);
create index if not exists agents_organization_idx on public.agents(organization_id);

-- Tras backfill, forzar NOT NULL en projects (si hay filas)
do $$
begin
  if exists (select 1 from public.projects where organization_id is null) then
    raise notice 'Hay projects sin organization_id; revisa el backfill antes de NOT NULL';
  else
    alter table public.projects alter column organization_id set not null;
  end if;
exception when others then
  raise notice 'No se pudo forzar NOT NULL en projects.organization_id: %', SQLERRM;
end $$;

notify pgrst, 'reload schema';

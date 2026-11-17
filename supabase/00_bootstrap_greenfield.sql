-- =============================================================================
-- PackLens — Bootstrap GREENFIELD (base Supabase vacía)
-- =============================================================================
-- Uso: Supabase → SQL Editor → Run (una sola vez en un proyecto nuevo)
--
-- Crea:
--   • public.users + trigger Auth → perfil
--   • organizations / memberships
--   • projects y tablas de negocio
--   • bucket privado packlens-files
--   • RLS básico (API usa service_role)
--   • org Packaging-wework + Admin (edita v_admin_email abajo)
--
-- Antes:
--   1. Crea el usuario en Authentication → Users (email + password)
--   2. Pon ese email en v_admin_email
-- =============================================================================

create extension if not exists pgcrypto;

-- ── 1) users + trigger Auth ───────────────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'Marketing'
    check (role in ('Marketing', 'Diseño', 'I+D', 'Comercial', 'Admin', 'Manager')),
  status text not null default 'Activo'
    check (status in ('Activo', 'Inactivo')),
  initials text,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (lower(email));
create index if not exists users_role_idx on public.users (role);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_role text;
  v_initials text;
  v_allowed text[] := array['Marketing', 'Diseño', 'I+D', 'Comercial', 'Admin', 'Manager'];
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'name', '')), '');
  if v_name is null then
    v_name := split_part(coalesce(new.email, 'user'), '@', 1);
  end if;

  v_role := nullif(trim(coalesce(new.raw_user_meta_data->>'role', '')), '');
  if v_role is null or not (v_role = any (v_allowed)) then
    v_role := 'Marketing';
  end if;

  v_initials := nullif(trim(coalesce(new.raw_user_meta_data->>'initials', '')), '');
  if v_initials is null then
    v_initials := upper(left(v_name, 2));
  end if;

  insert into public.users (id, name, email, role, status, initials)
  values (
    new.id,
    v_name,
    lower(coalesce(new.email, '')),
    v_role,
    'Activo',
    v_initials
  )
  on conflict (id) do update set
    email = excluded.email,
    name = case
      when public.users.name is null or btrim(public.users.name) = '' then excluded.name
      else public.users.name
    end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill Auth → users (si ya creaste el Admin antes)
insert into public.users (id, name, email, role, status, initials)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    split_part(u.email, '@', 1)
  ),
  lower(u.email),
  case
    when coalesce(u.raw_user_meta_data->>'role', '') in ('Marketing', 'Diseño', 'I+D', 'Comercial', 'Admin', 'Manager')
      then u.raw_user_meta_data->>'role'
    else 'Marketing'
  end,
  'Activo',
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'initials'), ''),
    upper(left(split_part(u.email, '@', 1), 2))
  )
from auth.users u
on conflict (id) do nothing;

-- ── 2) organizations / memberships ──────────────────────────────────────────
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

create index if not exists organizations_slug_idx on public.organizations (slug);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null,
  status text not null default 'Activo' check (status in ('Activo', 'Inactivo')),
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists memberships_org_idx on public.memberships (organization_id);

-- ── 3) agents ───────────────────────────────────────────────────────────────
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt text not null,
  role text not null check (role in ('Marketing', 'I+D')),
  status text not null default 'Activo' check (status in ('Activo', 'Inactivo')),
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agents_role_idx on public.agents (role);
create index if not exists agents_org_idx on public.agents (organization_id);

-- ── 4) projects ─────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null,
  market text,
  language text,
  flow_type text
    check (flow_type is null or flow_type in ('Nacional', 'Exportación', 'Marca Blanca', 'Campaña audiovisual')),
  status text not null default 'En diseño',
  phase text not null default 'Diseño',
  owner_id uuid references public.users(id) on delete set null,
  target_date date,
  description text,
  archived boolean not null default false,
  lifecycle_status text not null default 'Borrador',
  sap_code text,
  version integer not null default 1 check (version > 0),
  previous_version_id uuid references public.projects(id) on delete set null,
  substitution_type text
    check (substitution_type is null or substitution_type in ('Permanente', 'Temporal')),
  temporal_end_date date,
  discontinued boolean not null default false,
  product_line text,
  format text,
  markets text[] not null default '{}',
  label_languages text[] not null default '{}',
  label_languages_front text[] not null default '{}',
  label_languages_back text[] not null default '{}',
  launch_date date,
  art_deadline date,
  regulatory_contact text,
  design_lead text,
  briefing jsonb not null default '{}'::jsonb,
  marketing_assignee_type text not null default 'user'
    check (marketing_assignee_type in ('user', 'agent')),
  marketing_agent_id uuid references public.agents(id) on delete set null,
  regulatory_assignee_type text not null default 'user'
    check (regulatory_assignee_type in ('user', 'agent')),
  regulatory_agent_id uuid references public.agents(id) on delete set null,
  agent_review_running boolean not null default false,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_organization_idx on public.projects (organization_id);
create index if not exists projects_owner_idx on public.projects (owner_id);
create index if not exists projects_sku_org_active_idx
  on public.projects (organization_id, sku)
  where archived = false;

-- ── 5) attachments + propuestas ─────────────────────────────────────────────
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  mime_type text,
  file_size_kb integer check (file_size_kb is null or file_size_kb >= 0),
  storage_key text not null unique,
  is_image boolean not null default false,
  is_pdf boolean not null default false,
  is_zip boolean not null default false,
  page_count integer,
  created_at timestamptz not null default now()
);

create table if not exists public.design_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  version text,
  comments text,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_role text,
  uploaded_phase text,
  created_at timestamptz not null default now()
);

create index if not exists design_proposals_project_idx
  on public.design_proposals (project_id, created_at desc);

create table if not exists public.design_proposal_attachments (
  proposal_id uuid not null references public.design_proposals(id) on delete cascade,
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  primary key (proposal_id, attachment_id)
);

-- ── 6) workflow / actividad ─────────────────────────────────────────────────
create table if not exists public.phase_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase text not null,
  type text not null check (type in ('comment', 'approve', 'reject')),
  comment text,
  actor_id uuid references public.users(id) on delete set null,
  role text,
  agent_id uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists phase_actions_project_idx on public.phase_actions (project_id);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  text text not null,
  actor_id uuid references public.users(id) on delete set null,
  phase_action_id uuid references public.phase_actions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_project_idx
  on public.activity_events (project_id, created_at desc);

create table if not exists public.activity_replies (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.activity_events(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  text text not null,
  author_id uuid references public.users(id) on delete set null,
  role text,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid,
  version_id uuid,
  author_id uuid references public.users(id) on delete set null,
  role text,
  text text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists comments_project_idx on public.comments (project_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  owner_id uuid references public.users(id) on delete set null,
  role text,
  status text not null default 'Pendiente' check (status in ('Pendiente', 'Completada')),
  priority text not null default 'Media' check (priority in ('Alta', 'Media', 'Baja')),
  due_date date,
  created_at timestamptz not null default now()
);

create index if not exists tasks_project_idx on public.tasks (project_id);

create table if not exists public.arte_finals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.image_annotations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  proposal_id uuid not null references public.design_proposals(id) on delete cascade,
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  text text not null,
  position_x double precision,
  position_y double precision,
  page integer,
  phase text not null,
  author_id uuid references public.users(id) on delete set null,
  role text,
  created_at timestamptz not null default now()
);

create table if not exists public.review_ref_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  proposal_id uuid not null references public.design_proposals(id) on delete cascade,
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (proposal_id, attachment_id)
);

create table if not exists public.agent_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  phase text not null,
  decision text check (decision in ('approve', 'reject', 'error')),
  comment text,
  raw_response text,
  created_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_name text not null,
  hours numeric(8, 2) not null check (hours > 0 and hours <= 999),
  worked_on date not null default (now()::date),
  description text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists time_entries_project_idx on public.time_entries (project_id);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  role text not null,
  token text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references public.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invitations_email_idx on public.invitations (email);
create index if not exists invitations_token_idx on public.invitations (token);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create table if not exists public.upload_reservations (
  id uuid primary key default gen_random_uuid(),
  storage_key text not null unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  purpose text not null default 'arte_final' check (purpose in ('arte_final')),
  file_name text not null,
  mime_type text,
  expected_size bigint,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

-- ── 7) Storage bucket ───────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'packlens-files',
  'packlens-files',
  false,
  null,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/zip', 'application/x-zip-compressed',
    'application/postscript', 'application/illustrator',
    'image/vnd.adobe.photoshop',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 8) Grants / RLS (API = service_role) ─────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'organizations', 'memberships', 'agents', 'projects', 'attachments',
    'design_proposals', 'design_proposal_attachments', 'phase_actions',
    'activity_events', 'activity_replies', 'comments', 'tasks', 'arte_finals',
    'image_annotations', 'review_ref_attachments', 'agent_reviews', 'time_entries',
    'invitations', 'notifications', 'upload_reservations'
  ]
  loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

grant select on table public.organizations to authenticated;
grant select on table public.memberships to authenticated;

drop policy if exists organizations_select_own_membership on public.organizations;
drop policy if exists memberships_select_own on public.memberships;

create policy organizations_select_own_membership
  on public.organizations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.status = 'Activo'
    )
  );

create policy memberships_select_own
  on public.memberships
  for select
  to authenticated
  using (user_id = auth.uid());

-- ── 9) Seed Packaging-wework + Admin ────────────────────────────────────────
do $$
declare
  -- ─── Edita estos valores ──────────────────────────────────────────────────
  v_slug          text := 'packaging-wework';
  v_name          text := 'Packaging-wework';
  v_admin_email   text := 'tu-email@dominio.com';
  v_admin_name    text := 'Admin';
  v_template_key  text := 'packaging-helios';
  -- ─────────────────────────────────────────────────────────────────────────
  v_auth_id uuid;
  v_org_id uuid;
  v_initials text;
begin
  v_slug := lower(trim(v_slug));
  v_admin_email := lower(trim(v_admin_email));
  v_name := trim(v_name);

  select id into v_auth_id from auth.users where lower(email) = v_admin_email;
  if v_auth_id is null then
    raise exception
      'No existe % en Authentication → Users. Créalo primero y vuelve a ejecutar solo la sección seed, o todo el script otra vez (es idempotente en tablas).',
      v_admin_email;
  end if;

  if not exists (select 1 from public.users where id = v_auth_id) then
    v_initials := upper(left(coalesce(nullif(trim(v_admin_name), ''), split_part(v_admin_email, '@', 1)), 2));
    insert into public.users (id, name, email, role, status, initials)
    values (
      v_auth_id,
      coalesce(nullif(trim(v_admin_name), ''), split_part(v_admin_email, '@', 1)),
      v_admin_email,
      'Admin',
      'Activo',
      v_initials
    );
  else
    update public.users
    set role = 'Admin', status = 'Activo'
    where id = v_auth_id;
  end if;

  if exists (select 1 from public.organizations where slug = v_slug) then
    select id into v_org_id from public.organizations where slug = v_slug;
  else
    insert into public.organizations (slug, name, template_key, settings, status)
    values (v_slug, v_name, v_template_key, '{}'::jsonb, 'Activo')
    returning id into v_org_id;
  end if;

  insert into public.memberships (user_id, organization_id, role, status)
  values (v_auth_id, v_org_id, 'Admin', 'Activo')
  on conflict (user_id, organization_id) do update set
    role = 'Admin',
    status = 'Activo';

  raise notice 'OK — esquema listo. Org % (%) · Admin %', v_name, v_org_id, v_admin_email;
end $$;

notify pgrst, 'reload schema';

-- Verificación
select
  o.slug,
  o.name,
  o.template_key,
  u.email,
  u.role as users_role,
  m.role as membership_role
from public.organizations o
join public.memberships m on m.organization_id = o.id
join public.users u on u.id = m.user_id
where o.slug = 'packaging-wework';
;

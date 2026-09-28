-- PackLens AI agents (ejecutar en SQL Editor de Supabase)
-- Agentes de revisión para Marketing / I+D.

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt text not null,
  role text not null check (role in ('Marketing', 'I+D')),
  status text not null default 'Activo' check (status in ('Activo', 'Inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agents_role_idx on public.agents(role);
create index if not exists agents_status_idx on public.agents(status);

alter table public.projects
  add column if not exists marketing_assignee_type text not null default 'user';

alter table public.projects
  add column if not exists marketing_agent_id uuid references public.agents(id) on delete set null;

alter table public.projects
  add column if not exists regulatory_assignee_type text not null default 'user';

alter table public.projects
  add column if not exists regulatory_agent_id uuid references public.agents(id) on delete set null;

alter table public.projects
  add column if not exists agent_review_running boolean not null default false;

create index if not exists projects_marketing_agent_idx on public.projects(marketing_agent_id);
create index if not exists projects_regulatory_agent_idx on public.projects(regulatory_agent_id);

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

create index if not exists agent_reviews_project_idx on public.agent_reviews(project_id);

alter table public.phase_actions
  add column if not exists agent_id uuid references public.agents(id) on delete set null;

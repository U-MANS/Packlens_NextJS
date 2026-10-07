-- PackLens time tracking (ejecutar en SQL Editor de Supabase)
-- Registros de horas de empleados externos (no usuarios de la app).

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_name text not null,
  hours numeric(8,2) not null check (hours > 0 and hours <= 999),
  worked_on date not null default (now()::date),
  description text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists time_entries_project_idx on public.time_entries(project_id);
create index if not exists time_entries_worked_on_idx on public.time_entries(worked_on desc);
create index if not exists time_entries_employee_idx on public.time_entries(employee_name);

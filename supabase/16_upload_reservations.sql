-- PackLens: reservas de subida de un solo uso (arte final / signed upload)
-- Ejecutar en el SQL Editor de Supabase.
-- confirm debe consumir una reserva emitida para el mismo usuario+proyecto
-- y leer metadatos del objeto en Storage antes de registrar el attachment.

create table if not exists public.upload_reservations (
  id uuid primary key default gen_random_uuid(),
  storage_key text not null unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  purpose text not null default 'arte_final'
    check (purpose in ('arte_final')),
  file_name text not null,
  mime_type text,
  expected_size bigint,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists upload_reservations_project_user_idx
  on public.upload_reservations (project_id, user_id);

create index if not exists upload_reservations_open_idx
  on public.upload_reservations (storage_key)
  where consumed_at is null;

-- Solo service_role (API Next.js). Sin lectura/escritura desde Data API de clientes.
revoke all on table public.upload_reservations from anon, authenticated;
grant all on table public.upload_reservations to service_role;

alter table public.upload_reservations enable row level security;

notify pgrst, 'reload schema';

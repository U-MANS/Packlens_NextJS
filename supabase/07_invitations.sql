-- PackLens invitations (ejecutar en SQL Editor de Supabase)
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  role text not null,
  token text not null unique,
  status text not null default 'pending',
  invited_by uuid references public.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invitations_email_idx on public.invitations(email);
create index if not exists invitations_token_idx on public.invitations(token);

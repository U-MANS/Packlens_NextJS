-- PackLens multi-tenant: RLS + grants para organizations / memberships
-- Ejecutar DESPUÉS de 14_organizations.sql en el SQL Editor de Supabase.
-- La API Next.js usa service_role (bypass RLS). anon/authenticated no deben
-- leer roles ajenos ni escribir memberships desde el cliente.

-- ── Revocar acceso directo Data API ─────────────────────────────────────────
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.memberships from anon, authenticated;

-- service_role / postgres siguen pudiendo administrar (bypass RLS en service_role)
grant all on table public.organizations to service_role;
grant all on table public.memberships to service_role;

-- ── Habilitar RLS (sin políticas de escritura para clientes) ────────────────
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

-- Limpiar políticas previas si se re-ejecuta el script
drop policy if exists organizations_select_own_membership on public.organizations;
drop policy if exists memberships_select_own on public.memberships;
drop policy if exists organizations_no_write on public.organizations;
drop policy if exists memberships_no_insert on public.memberships;
drop policy if exists memberships_no_update on public.memberships;
drop policy if exists memberships_no_delete on public.memberships;

-- Lectura opcional autenticada: solo orgs donde el usuario tiene membership activa.
-- No concede INSERT/UPDATE/DELETE (grants arriba ya revocados).
grant select on table public.organizations to authenticated;
grant select on table public.memberships to authenticated;

create policy organizations_select_own_membership
  on public.organizations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
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

-- anon: sin grants + RLS = sin acceso
-- authenticated: sin grants de escritura = no puede autoasignarse rol Admin/Manager

-- ── Verificación rápida (ejecutar y revisar en staging) ─────────────────────
-- select c.relname, c.relrowsecurity
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname in ('organizations', 'memberships');
--
-- select grantee, table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in ('organizations', 'memberships')
--   and grantee in ('anon', 'authenticated', 'service_role')
-- order by table_name, grantee, privilege_type;

notify pgrst, 'reload schema';

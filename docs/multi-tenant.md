# Multi-tenant PackLens (Helios + plantillas)

## Modelo

- Una sola base Postgres/Supabase.
- Cada tenant es una fila en `organizations`.
- Usuarios se vinculan con `memberships` (rol por org).
- Datos de negocio (`projects`, `invitations`, `agents`) llevan `organization_id`.
- Helios (`slug=helios`, id fijo `a0000000-0000-4000-8000-000000000001`) es el cliente actual: backfill de filas existentes + memberships desde `users.role`.

## Migración

1. Ejecutar en el SQL Editor de Supabase: [`supabase/14_organizations.sql`](../supabase/14_organizations.sql).
2. Verificar:
   - Existe org `helios`.
   - Todos los `projects` tienen `organization_id` de Helios.
   - Cada usuario activo tiene membership en Helios.
3. Reiniciar PostgREST si hace falta (`notify pgrst, 'reload schema'` ya está en el script).

## Feature flag

| Variable | Efecto |
|----------|--------|
| `MULTI_TENANT=true` (default si no se define) | Resuelve org activa (header `X-Organization-Id` / membership). |
| `MULTI_TENANT=false` | Org Helios implícita; APIs se comportan como antes. |

También se lee `NEXT_PUBLIC_MULTI_TENANT` en cliente si hace falta.

## Roles de gestión (Helios)

| Rol | Alcance |
|-----|---------|
| `Admin` | Plataforma: Config. tenant (`/admin/org`), usuarios, agentes y poderes operativos. Puede **cambiar de tenant** en la topbar (todos los clientes). |
| `Manager` | Jefe de cliente: mismos poderes operativos (usuarios, agentes, aprobar/actuar en todas las fases), **sin** Config. tenant. No puede crear/editar/eliminar usuarios `Admin`. |

## Plantillas

Definidas en código (`src/lib/tenant/templates/`):

| Key | Uso |
|-----|-----|
| `packaging-helios` | Snapshot del flujo actual (fases, paralelo Validación/Legal, roles, nav completa). |
| `packaging-standard` | Copia editable; agentes off. |
| `audiovisual-lite` | Flujo corto AV; sin Legal ni biblioteca. |

La org guarda `template_key` + `settings` (overrides JSON: labels de fase, nav, etc.).
La config efectiva = `mergeTenantConfig(template, settings)`.

## Crear un tenant nuevo

1. Insertar en `organizations` (slug único, `template_key` deseada, `settings` vacío o clonado).
2. Crear `memberships` para el Admin inicial.
3. (Opcional) Invitar usuarios con `invitations.organization_id` apuntando al nuevo tenant.
4. El Admin entra en **Config. tenant** (`/admin/org`) para renombrar fases, menú y aplicar otra plantilla.

## Checklist Helios sin regresiones

- [ ] Tras `14_organizations.sql`, login Helios sigue viendo los mismos proyectos.
- [ ] Pipeline Nacional: Diseño ?  ? Validación + Legal en paralelo ? Arte final ? 
- [ ] Roles Marketing / Diseño / I+D / Admin aprueban las mismas fases que antes.
- [ ] Menú completo (Dashboard, Proyectos, Biblioteca, Moodboard, Campañas, Horas, Usuarios, Agentes).
- [ ] Con `MULTI_TENANT=false`, la app no exige header de org.
- [ ] Un proyecto de org A no aparece en listados de org B (cuando existan dos orgs).

## API

- `GET /api/v1/auth/me` ? usuario + `organization` + `tenant_config` + `memberships`.
- `GET/PATCH /api/v1/org` ? leer/actualizar settings (PATCH solo Admin).
- Header `X-Organization-Id` (el cliente lo envía desde `localStorage`).

## Fuera de alcance (esta rama)

DB dedicada por tenant, SSO/SAML, billing, motor BPM genérico completo.

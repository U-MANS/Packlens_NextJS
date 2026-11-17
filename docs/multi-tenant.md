# Multi-tenant compartido (retirado)

El modo de **varias organizaciones en la misma base** (selector de tenant, salto de Admin entre clientes, `MULTI_TENANT`, cabecera `X-Organization-Id`) se ha eliminado del código.

Modelo actual: **[multi-instancia](./multi-instance.md)** — un proyecto Supabase + un proyecto Vercel por cliente.

Lo que se mantiene por instancia:

- tabla `organizations` (nombre, `template_key`, `settings`)
- `memberships` (roles)
- `organization_id` en proyectos
- plantillas de producto y `/admin/org`

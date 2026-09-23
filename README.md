# PackLens Next.js (full-stack)

Proyecto paralelo que unifica el front React y el back FastAPI en **un solo** app Next.js (App Router).

## Qué incluye

- UI completa portada desde `PackLens_React` (SPA embebida con React Router)
- API Route Handlers en `/api/v1/*` alineados con el backend Python:
  - Auth (login, refresh, logout, me, debug/register)
  - Users CRUD + invitaciones
  - Projects CRUD, clone, versions, archive, discontinue, briefing-files
  - Workflow (approve / reject / comment)
  - Proposals, arte-finals (multipart + signed upload), annotations, review-refs
  - Tasks, comments, activity + replies
  - Files proxy, dashboard, catalogs, notifications

## Arranque

```bash
cd PackLens_Nextjs
cp .env.example .env.local   # o usa el .env.local ya preparado
npm install
npm run dev
```

Abre **http://localhost:3000**

## Supabase

1. El proyecto debe estar **activo** (DNS resoluble).
2. Para invitaciones, ejecuta en el SQL Editor:

```sql
-- ver supabase/07_invitations.sql
```

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_API_URL` | Base del cliente (`/api/v1`) |
| `SUPABASE_URL` | Proyecto Supabase |
| `SUPABASE_ANON_KEY` | Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Consultas server-side + Storage |
| `DEBUG_ENABLE_SIGNUP` | Habilita `/auth/debug/register` |

## Estructura

```
src/
  app/
    [[...slug]]/     # Shell SPA (UI)
    api/v1/          # Backend Next (Route Handlers)
  App.tsx            # Rutas React Router (UI)
  views/             # Pantallas (ex-pages; renombrado por conflicto con Next)
  api/               # Cliente HTTP del front
  components/ store/ ...
  lib/               # Supabase + helpers server
```

## Pendiente opcional

- Envío real de emails de invitación (Brevo)
- Campañas / documentos avanzados si se reactivan en la UI
- Migrar React Router → App Router nativo

Los repos `PackLens_React` y `PackLens_Python` se mantienen intactos.

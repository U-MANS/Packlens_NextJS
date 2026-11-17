# PackLens — Multi-instancia (1 Vercel + 1 Supabase por cliente)

## Modelo

| Cliente | Proyecto Supabase | Proyecto Vercel | Variables |
|---------|-------------------|-----------------|-----------|
| Helios | proyecto A | Vercel A | env solo de A |
| Packaging-wework | proyecto B | Vercel B | env solo de B |

- **Mismo código** (mismo repo PackLens).
- **Distinto hosting** (un proyecto Vercel por cliente).
- **Distinta base** (un proyecto Supabase por cliente).
- Sin selector de tenant ni salto de Admin entre clientes.
- Cada instancia tiene su org (`organizations` + `memberships`) y plantilla de producto (`template_key`).

## Variables por proyecto Vercel

```env
NEXT_PUBLIC_SUPABASE_URL=https://ESTE_CLIENTE.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

SUPABASE_URL=https://ESTE_CLIENTE.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_STORAGE_BUCKET=packlens-files

NEXT_PUBLIC_API_URL=/api/v1
FRONTEND_BASE_URL=https://url-de-este-vercel.vercel.app

BREVO_API_KEY=...
OPENAI_API_KEY=...
```

Keys: Dashboard → **Settings → API Keys** (publishable / secret).

Opcional si hay más de una org en esa DB:

```env
DEFAULT_ORGANIZATION_SLUG=packaging-wework
```

## Alta de un cliente nuevo (DB vacía)

1. Crear **proyecto Supabase** nuevo.
2. Crear Admin en Authentication → Users (email + password).
3. Abrir [`supabase/00_bootstrap_greenfield.sql`](../supabase/00_bootstrap_greenfield.sql), edita `v_admin_email` y ejecútalo.
4. Crear **proyecto Vercel** nuevo → mismo repo PackLens.
5. Pegar las env de **ese** Supabase.
6. Deploy (`npm run deploy:helios` / `npm run deploy:wework`).

Si la DB ya tiene esquema y solo falta la org:

- `supabase/templates/create_blank_org_packaging_wework.sql`

## Deploy CLI

```bash
npm run deploy:helios
npm run deploy:wework
```

Configura `.env.vercel.helios` / `.env.vercel.wework` con `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID`.

## Checklist por instancia

- [ ] Proyecto Vercel propio.
- [ ] Env apunta solo a su Supabase.
- [ ] Una org activa (o `DEFAULT_ORGANIZATION_SLUG`).
- [ ] Membership Admin del usuario inicial.
- [ ] Login sin selector de tenant.
- [ ] Datos/demo solo afectan a esa DB.

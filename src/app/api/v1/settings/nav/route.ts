import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/server/http';
import { requireOrg } from '@/lib/server/org';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  isConfigurableNavId,
  mergeTenantConfig,
  resolveNavVisibility,
} from '@/lib/tenant/config';
import { CONFIGURABLE_NAV_IDS } from '@/lib/tenant/types';
import type { NavVisibilityMap, TenantSettingsOverride } from '@/lib/tenant/types';
import { isPlatformAdminRole } from '@/types';

function assertAdmin(ctx: { user: { role: string } }) {
  if (!isPlatformAdminRole(ctx.user.role)) {
    return jsonError('Solo Admin puede configurar las pestañas', 403);
  }
  return null;
}

/** GET: estado de pestañas configurables (Admin). */
export async function GET(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  const denied = assertAdmin(ctx);
  if (denied) return denied;

  const visibility = resolveNavVisibility(ctx.config, ctx.organization.settings);
  const items = CONFIGURABLE_NAV_IDS.map((id) => {
    const def = ctx.config.nav.find((n) => n.id === id);
    return {
      id,
      label: def?.label ?? id,
      path: def?.path ?? `/${id}`,
      enabled: visibility[id] !== false,
    };
  }).filter((item) => ctx.config.nav.some((n) => n.id === item.id));

  return jsonOk({
    navVisibility: visibility,
    items,
  });
}

/** PATCH: Admin actualiza qué pestañas ven el resto de miembros. */
export async function PATCH(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  const denied = assertAdmin(ctx);
  if (denied) return denied;

  const body = (await request.json()) as { navVisibility?: Record<string, boolean> };
  if (!body.navVisibility || typeof body.navVisibility !== 'object') {
    return jsonError('navVisibility es obligatorio', 400);
  }

  const nextVisibility: NavVisibilityMap = {
    ...resolveNavVisibility(ctx.config, ctx.organization.settings),
  };
  for (const [key, value] of Object.entries(body.navVisibility)) {
    if (!isConfigurableNavId(key)) continue;
    if (typeof value !== 'boolean') continue;
    nextVisibility[key] = value;
  }

  const prevSettings = (ctx.organization.settings || {}) as TenantSettingsOverride;
  const nextSettings: TenantSettingsOverride = {
    ...prevSettings,
    navVisibility: nextVisibility,
  };

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('organizations')
    .update({
      settings: nextSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.organizationId)
    .select('*')
    .single();

  if (error || !data) {
    return jsonError(error?.message || 'No se pudo guardar la configuración', 500);
  }

  const config = mergeTenantConfig(data.template_key, nextSettings);
  return jsonOk({
    navVisibility: nextVisibility,
    config,
  });
}

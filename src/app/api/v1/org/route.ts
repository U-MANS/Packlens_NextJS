import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/server/http';
import { orgToApi, requireOrg } from '@/lib/server/org';
import { canManageOrgSettings } from '@/lib/server/permissions';
import { getAdminClient } from '@/lib/supabase/admin';
import { mergeTenantConfig } from '@/lib/tenant/config';
import { TEMPLATE_CATALOG } from '@/lib/tenant/templates';
import type { TenantSettingsOverride } from '@/lib/tenant/types';
import { verifyHeliosTemplateParity } from '@/lib/tenant/verifyHelios';

/** GET org activa + config resuelta + catálogo de plantillas. */
export async function GET(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;

  const check = new URL(request.url).searchParams.get('check');
  return jsonOk({
    organization: orgToApi(ctx),
    config: ctx.config,
    template_key: ctx.organization.template_key,
    settings: ctx.organization.settings || {},
    templates: Object.keys(TEMPLATE_CATALOG).map((key) => ({
      key,
      name: TEMPLATE_CATALOG[key].name,
    })),
    ...(check === 'helios' ? { helios_parity: verifyHeliosTemplateParity() } : {}),
  });
}

/** PATCH: Admin actualiza settings / template / labels del tenant. */
export async function PATCH(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  if (!canManageOrgSettings(ctx.user, ctx.config)) {
    return jsonError('Solo Admin de plataforma puede configurar el tenant', 403);
  }

  const body = (await request.json()) as {
    name?: string;
    template_key?: string;
    settings?: TenantSettingsOverride;
    apply_template?: boolean;
  };

  const admin = getAdminClient();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === 'string' && body.name.trim()) {
    updates.name = body.name.trim();
  }

  let nextTemplate = ctx.organization.template_key;
  if (typeof body.template_key === 'string' && body.template_key in TEMPLATE_CATALOG) {
    nextTemplate = body.template_key;
    updates.template_key = body.template_key;
  }

  let nextSettings = (ctx.organization.settings || {}) as TenantSettingsOverride;
  if (body.apply_template) {
    // Reset overrides al aplicar plantilla limpia
    nextSettings = {};
    updates.settings = nextSettings;
  } else if (body.settings && typeof body.settings === 'object') {
    nextSettings = { ...nextSettings, ...body.settings };
    updates.settings = nextSettings;
  }

  const { data, error } = await admin
    .from('organizations')
    .update(updates)
    .eq('id', ctx.organizationId)
    .select('*')
    .single();

  if (error || !data) {
    return jsonError(error?.message || 'No se pudo actualizar la organización', 500);
  }

  const config = mergeTenantConfig(nextTemplate, nextSettings);
  return jsonOk({
    organization: {
      id: data.id,
      slug: data.slug,
      name: data.name,
      template_key: data.template_key,
      status: data.status,
    },
    config,
    settings: data.settings || {},
  });
}

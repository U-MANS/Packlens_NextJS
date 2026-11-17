import { getAdminClient } from '@/lib/supabase/admin';
import { jsonError } from '@/lib/server/http';
import {
  defaultOrganizationId,
  defaultOrganizationSlug,
  mergeTenantConfig,
} from '@/lib/tenant/config';
import type { OrganizationRow, TenantConfig } from '@/lib/tenant/types';
import type { DbUser } from '@/lib/server/auth';
import { requireUser } from '@/lib/server/auth';

export type OrgMembership = {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  status: string;
};

export type OrgContext = {
  user: DbUser;
  organizationId: string;
  organization: OrganizationRow;
  membership: OrgMembership | null;
  /** Rol efectivo (membership o users.role). */
  role: string;
  config: TenantConfig;
};

async function loadOrganization(
  admin: ReturnType<typeof getAdminClient>,
  idOrSlug: string,
): Promise<OrganizationRow | null> {
  const byId = await admin.from('organizations').select('*').eq('id', idOrSlug).maybeSingle();
  if (!byId.error && byId.data) return byId.data as OrganizationRow;
  const bySlug = await admin.from('organizations').select('*').eq('slug', idOrSlug).maybeSingle();
  if (!bySlug.error && bySlug.data) return bySlug.data as OrganizationRow;
  return null;
}

/**
 * Org de esta instancia (1 Supabase = 1 cliente):
 * 1) DEFAULT_ORGANIZATION_ID
 * 2) DEFAULT_ORGANIZATION_SLUG
 * 3) primera org Activa
 */
export async function resolveInstanceOrganization(
  admin: ReturnType<typeof getAdminClient> = getAdminClient(),
): Promise<OrganizationRow | null> {
  const byId = defaultOrganizationId();
  if (byId) {
    const org = await loadOrganization(admin, byId);
    if (org?.status === 'Activo') return org;
  }
  const bySlug = defaultOrganizationSlug();
  if (bySlug) {
    const org = await loadOrganization(admin, bySlug);
    if (org?.status === 'Activo') return org;
  }

  const { data, error } = await admin
    .from('organizations')
    .select('*')
    .eq('status', 'Activo')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error || !data?.length) return null;
  return data[0] as OrganizationRow;
}

/**
 * Resuelve usuario + organización de esta instancia.
 * Sin selector multi-tenant: siempre la org de la DB/despliegue actual.
 */
export async function requireOrg(request: Request): Promise<OrgContext | Response> {
  const userOrErr = await requireUser(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr;
  const admin = getAdminClient();

  const organization = await resolveInstanceOrganization(admin);
  if (!organization) {
    return jsonError(
      'No hay organización en esta instancia. Ejecuta el bootstrap SQL (p. ej. 00_bootstrap_greenfield.sql).',
      503,
    );
  }

  const { data: membershipRow, error: memErr } = await admin
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .eq('organization_id', organization.id)
    .eq('status', 'Activo')
    .maybeSingle();

  if (memErr) {
    console.error('[requireOrg] memberships query failed', memErr.message);
    return jsonError('No se pudo verificar la autorización de organización', 503);
  }

  const membership = (membershipRow as OrgMembership | null) ?? null;
  if (!membership && user.role !== 'Admin') {
    return jsonError('Sin acceso a esta organización', 403);
  }

  const role = membership?.role || user.role;
  return {
    user: { ...user, role },
    organizationId: organization.id,
    organization,
    membership,
    role,
    config: mergeTenantConfig(organization.template_key, organization.settings),
  };
}

export async function listUserMemberships(userId: string, organizationId?: string) {
  const admin = getAdminClient();
  let query = admin
    .from('memberships')
    .select('*, organizations(*)')
    .eq('user_id', userId)
    .eq('status', 'Activo');
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data: memberships } = await query;
  return memberships || [];
}

/** Carga proyecto y verifica que pertenece a la org activa. */
export async function getProjectInOrg(
  projectId: string,
  organizationId: string,
  columns = '*',
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('projects')
    .select(columns)
    .eq('id', projectId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    if (/organization_id/i.test(error.message)) {
      const fallback = await admin.from('projects').select(columns).eq('id', projectId).maybeSingle();
      if (fallback.error) return { data: null, error: fallback.error.message };
      return {
        data: fallback.data ? (fallback.data as unknown as Record<string, unknown>) : null,
        error: null,
      };
    }
    return { data: null, error: error.message };
  }
  return {
    data: data ? (data as unknown as Record<string, unknown>) : null,
    error: null,
  };
}

/**
 * Mutación acotada a la org de la instancia. Si el id no pertenece → not_found (404).
 */
export async function updateProjectInOrg(
  projectId: string,
  organizationId: string,
  updates: Record<string, unknown>,
): Promise<{ error: string | null; notFound?: boolean }> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .eq('organization_id', organizationId)
    .select('id');

  if (error) {
    if (/organization_id/i.test(error.message)) {
      const retry = await admin.from('projects').update(updates).eq('id', projectId).select('id');
      if (retry.error) return { error: retry.error.message };
      if (!retry.data?.length) return { error: null, notFound: true };
      return { error: null };
    }
    return { error: error.message };
  }
  if (!data?.length) return { error: null, notFound: true };
  return { error: null };
}

export function orgToApi(ctx: OrgContext) {
  return {
    id: ctx.organization.id,
    slug: ctx.organization.slug,
    name: ctx.organization.name,
    template_key: ctx.organization.template_key,
    status: ctx.organization.status,
  };
}

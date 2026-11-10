import { getAdminClient } from '@/lib/supabase/admin';
import { jsonError } from '@/lib/server/http';
import {
  HELIOS_ORG_ID,
  HELIOS_ORG_SLUG,
  isMultiTenantEnabled,
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
  /** Rol efectivo en el tenant (membership o users.role). */
  role: string;
  config: TenantConfig;
};

function requestedOrgId(request: Request): string | null {
  const header =
    request.headers.get('x-organization-id') ??
    request.headers.get('X-Organization-Id');
  if (header?.trim()) return header.trim();
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('organization_id');
    if (q?.trim()) return q.trim();
  } catch {
    /* ignore */
  }
  return null;
}

async function loadOrganization(
  admin: ReturnType<typeof getAdminClient>,
  idOrSlug: string
): Promise<OrganizationRow | null> {
  const byId = await admin.from('organizations').select('*').eq('id', idOrSlug).maybeSingle();
  if (!byId.error && byId.data) return byId.data as OrganizationRow;
  const bySlug = await admin.from('organizations').select('*').eq('slug', idOrSlug).maybeSingle();
  if (!bySlug.error && bySlug.data) return bySlug.data as OrganizationRow;
  return null;
}

async function ensureHeliosFallback(
  admin: ReturnType<typeof getAdminClient>
): Promise<OrganizationRow> {
  const existing = await loadOrganization(admin, HELIOS_ORG_ID);
  if (existing) return existing;
  const bySlug = await loadOrganization(admin, HELIOS_ORG_SLUG);
  if (bySlug) return bySlug;
  return {
    id: HELIOS_ORG_ID,
    slug: HELIOS_ORG_SLUG,
    name: 'Helios',
    template_key: 'packaging-helios',
    settings: {},
    status: 'Activo',
  };
}

/**
 * Resuelve usuario + organización activa.
 * Si MULTI_TENANT=false o aún no hay tablas/memberships, usa Helios implícita.
 */
export async function requireOrg(request: Request): Promise<OrgContext | Response> {
  const userOrErr = await requireUser(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr;
  const admin = getAdminClient();

  if (!isMultiTenantEnabled()) {
    const organization = await ensureHeliosFallback(admin);
    return {
      user,
      organizationId: organization.id,
      organization,
      membership: null,
      role: user.role,
      config: mergeTenantConfig(organization.template_key, organization.settings),
    };
  }

  const { data: memberships, error: memErr } = await admin
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'Activo');

  // Tabla aún no migrada → Helios implícita
  if (memErr) {
    const organization = await ensureHeliosFallback(admin);
    return {
      user,
      organizationId: organization.id,
      organization,
      membership: null,
      role: user.role,
      config: mergeTenantConfig(organization.template_key, organization.settings),
    };
  }

  const list = (memberships || []) as OrgMembership[];
  const wanted = requestedOrgId(request);
  /** Admin de plataforma (users.role): puede entrar a cualquier tenant. */
  const isPlatformAdmin = user.role === 'Admin';

  let membership: OrgMembership | null = null;
  let organization: OrganizationRow | null = null;

  if (wanted) {
    membership = list.find((m) => m.organization_id === wanted) || null;
    if (!membership) {
      if (!isPlatformAdmin) return jsonError('Sin acceso a esta organización', 403);
      organization = await loadOrganization(admin, wanted);
      if (!organization) return jsonError('Organización no encontrada', 404);
    }
  } else if (list.length === 1) {
    membership = list[0];
  } else if (list.length > 1) {
    membership =
      list.find((m) => m.organization_id === HELIOS_ORG_ID) || list[0] || null;
  }

  if (membership && !organization) {
    organization =
      (await loadOrganization(admin, membership.organization_id)) ||
      (await ensureHeliosFallback(admin));
  } else if (!organization) {
    organization = await ensureHeliosFallback(admin);
    // Auto-membership de emergencia (usuario pre-migración)
    await admin.from('memberships').upsert(
      {
        user_id: user.id,
        organization_id: organization.id,
        role: user.role,
        status: 'Activo',
      },
      { onConflict: 'user_id,organization_id' }
    );
    membership = {
      id: '',
      user_id: user.id,
      organization_id: organization.id,
      role: user.role,
      status: 'Activo',
    };
  }

  // Plataforma Admin sin membership en el tenant activo: mantiene Admin
  const role = membership?.role || (isPlatformAdmin ? 'Admin' : user.role);
  return {
    user: { ...user, role },
    organizationId: organization.id,
    organization,
    membership,
    role,
    config: mergeTenantConfig(organization.template_key, organization.settings),
  };
}

export async function listAllOrganizations(): Promise<
  Array<{ id: string; slug: string; name: string; template_key: string; status: string }>
> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('organizations')
    .select('id, slug, name, template_key, status')
    .eq('status', 'Activo')
    .order('name');
  if (error) return [];
  return (data || []) as Array<{
    id: string;
    slug: string;
    name: string;
    template_key: string;
    status: string;
  }>;
}

export async function listUserMemberships(userId: string) {
  const admin = getAdminClient();
  const { data: memberships } = await admin
    .from('memberships')
    .select('*, organizations(*)')
    .eq('user_id', userId)
    .eq('status', 'Activo');
  return memberships || [];
}

/** Carga proyecto y verifica que pertenece a la org activa. */
export async function getProjectInOrg(
  projectId: string,
  organizationId: string,
  columns = '*'
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('projects')
    .select(columns)
    .eq('id', projectId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    // Columna organization_id aún no existe → fallback sin filtro
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

export function orgToApi(ctx: OrgContext) {
  return {
    id: ctx.organization.id,
    slug: ctx.organization.slug,
    name: ctx.organization.name,
    template_key: ctx.organization.template_key,
    status: ctx.organization.status,
  };
}

import { NextRequest } from 'next/server';
import { userToApi } from '@/lib/server/auth';
import { jsonOk } from '@/lib/server/http';
import { listUserMemberships, orgToApi, requireOrg } from '@/lib/server/org';
import { getAdminClient } from '@/lib/supabase/admin';
import { isPlatformAdminRole } from '@/types';

export async function GET(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;

  const membershipsRaw = await listUserMemberships(ctx.user.id, ctx.organizationId);
  const memberships = membershipsRaw.map((m: Record<string, unknown>) => {
    const org = m.organizations as
      | { id: string; slug: string; name: string; template_key: string; status: string }
      | null
      | undefined;
    return {
      organization_id: m.organization_id as string,
      role: m.role as string,
      status: m.status as string,
      organization: org
        ? {
            id: org.id,
            slug: org.slug,
            name: org.name,
            template_key: org.template_key,
            status: org.status,
          }
        : null,
    };
  });

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', ctx.user.id)
    .maybeSingle();

  return jsonOk({
    ...userToApi(ctx.user),
    organization: orgToApi(ctx),
    organization_id: ctx.organizationId,
    tenant_config: ctx.config,
    memberships,
    is_platform_admin: isPlatformAdminRole(profile?.role),
  });
}

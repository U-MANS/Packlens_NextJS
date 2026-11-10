import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/server/http';
import { requireOrg } from '@/lib/server/org';
import { projectsToRead } from '@/lib/server/serializers';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;

  const admin = getAdminClient();
  let { data, error } = await admin
    .from('projects')
    .select('*, owner_user:users!projects_owner_id_fkey(name)')
    .eq('archived', false)
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error && /organization_id/i.test(error.message)) {
    const fallback = await admin
      .from('projects')
      .select('*, owner_user:users!projects_owner_id_fkey(name)')
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(10);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) return jsonError(error.message, 500);
  return jsonOk(await projectsToRead((data ?? []) as Parameters<typeof projectsToRead>[0]));
}

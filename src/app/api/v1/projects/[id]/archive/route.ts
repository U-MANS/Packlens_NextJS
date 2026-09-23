import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getAdminClient } from '@/lib/supabase/admin';
import { reloadProject } from '@/lib/server/workflow';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const admin = getAdminClient();
  const { data: project } = await admin.from('projects').select('id').eq('id', id).maybeSingle();
  if (!project) return jsonError('Proyecto no encontrado', 404);

  const { error } = await admin
    .from('projects')
    .update({ archived: true, status: 'Archivado', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return jsonError(error.message, 500);
  return jsonOk(await reloadProject(id));
}

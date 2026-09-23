import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('comments')
    .update({ resolved: true })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError('Comentario no encontrado', 404);
  return jsonOk({
    id: data.id,
    project_id: data.project_id,
    document_id: data.document_id,
    version_id: data.version_id,
    author: null,
    role: data.role,
    text: data.text,
    resolved: true,
    created_at: data.created_at,
  });
}

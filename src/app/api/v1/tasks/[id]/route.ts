import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const admin = getAdminClient();
  const { data: existing } = await admin.from('tasks').select('*').eq('id', id).maybeSingle();
  if (!existing) return jsonError('Tarea no encontrada', 404);

  const { data, error } = await admin.from('tasks').update(body).eq('id', id).select('*').single();
  if (error || !data) return jsonError(error?.message || 'Error actualizando tarea', 500);
  return jsonOk({
    id: data.id,
    project_id: data.project_id,
    title: data.title,
    owner: null,
    role: data.role,
    status: data.status,
    priority: data.priority,
    due_date: data.due_date,
  });
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const admin = getAdminClient();
  const { data } = await admin.from('tasks').select('id').eq('id', id).maybeSingle();
  if (!data) return jsonError('Tarea no encontrada', 404);
  const { error } = await admin.from('tasks').delete().eq('id', id);
  if (error) return jsonError(error.message, 500);
  return new Response(null, { status: 204 });
}

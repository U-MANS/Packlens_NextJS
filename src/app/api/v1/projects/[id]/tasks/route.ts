import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getProjectRow } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

function mapTask(t: Record<string, unknown>) {
  return {
    id: t.id,
    project_id: t.project_id,
    title: t.title,
    owner: null,
    role: t.role ?? null,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date ?? null,
  };
}

export async function GET(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const admin = getAdminClient();
  const { data, error } = await admin.from('tasks').select('*').eq('project_id', id).order('due_date');
  if (error) return jsonError(error.message, 500);
  return jsonOk((data ?? []).map((t) => mapTask(t)));
}

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);

  const body = (await request.json()) as {
    title: string;
    role?: string;
    priority?: string;
    due_date?: string | null;
    owner_name?: string;
  };

  const admin = getAdminClient();
  let owner_id: string | null = null;
  if (body.owner_name) {
    const { data: owner } = await admin
      .from('users')
      .select('id')
      .ilike('name', body.owner_name)
      .maybeSingle();
    owner_id = owner?.id ?? null;
  }

  const { data, error } = await admin
    .from('tasks')
    .insert({
      project_id: id,
      title: body.title,
      owner_id,
      role: body.role ?? null,
      priority: body.priority ?? 'Media',
      due_date: body.due_date ?? null,
      status: 'Pendiente',
    })
    .select('*')
    .single();
  if (error || !data) return jsonError(error?.message || 'Error creando tarea', 500);
  return jsonOk(mapTask(data), { status: 201 });
}

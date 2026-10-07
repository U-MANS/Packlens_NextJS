import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getTimeEntry, timeEntryToApi, type TimeEntryRow } from '@/lib/server/timeEntries';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;

  const existing = await getTimeEntry(id);
  if (!existing) return jsonError('Registro no encontrado', 404);

  const body = (await request.json()) as {
    project_id?: string;
    employee_name?: string;
    hours?: number;
    worked_on?: string;
    description?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (body.project_id !== undefined) {
    const projectId = body.project_id.trim();
    if (!projectId) return jsonError('Proyecto obligatorio', 400);
    updates.project_id = projectId;
  }
  if (body.employee_name !== undefined) {
    const name = body.employee_name.trim();
    if (!name) return jsonError('Nombre del empleado obligatorio', 400);
    updates.employee_name = name;
  }
  if (body.hours !== undefined) {
    const hours = Number(body.hours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 999) {
      return jsonError('Las horas deben ser un número mayor que 0', 400);
    }
    updates.hours = hours;
  }
  if (body.worked_on !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.worked_on)) {
      return jsonError('Fecha de trabajo inválida', 400);
    }
    updates.worked_on = body.worked_on;
  }
  if (body.description !== undefined) {
    updates.description = body.description?.trim() || null;
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('time_entries')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) return jsonError(error?.message || 'Error actualizando el registro', 500);

  const projectId = (data as TimeEntryRow).project_id;
  const { data: project } = await admin
    .from('projects')
    .select('name, sku')
    .eq('id', projectId)
    .maybeSingle();

  return jsonOk(timeEntryToApi(data as TimeEntryRow, project));
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;

  const existing = await getTimeEntry(id);
  if (!existing) return jsonError('Registro no encontrado', 404);

  const admin = getAdminClient();
  const { error } = await admin.from('time_entries').delete().eq('id', id);
  if (error) return jsonError(error.message, 500);
  return new Response(null, { status: 204 });
}

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { timeEntryToApi, type TimeEntryRow } from '@/lib/server/timeEntries';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const employee = searchParams.get('employee');

  const admin = getAdminClient();
  let query = admin
    .from('time_entries')
    .select('*, project:projects(name, sku)')
    .order('worked_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);
  if (from) query = query.gte('worked_on', from);
  if (to) query = query.lte('worked_on', to);
  if (employee?.trim()) query = query.ilike('employee_name', `%${employee.trim()}%`);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  return jsonOk(
    (data ?? []).map((row) => {
      const { project, ...entry } = row as TimeEntryRow & {
        project?: { name?: string; sku?: string } | null;
      };
      return timeEntryToApi(entry, project);
    }),
  );
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const body = (await request.json()) as {
    project_id?: string;
    employee_name?: string;
    hours?: number;
    worked_on?: string;
    description?: string;
  };

  const projectId = body.project_id?.trim() ?? '';
  const employeeName = body.employee_name?.trim() ?? '';
  const hours = Number(body.hours);
  const workedOn = body.worked_on?.trim() ?? '';
  const description = body.description?.trim() || null;

  if (!projectId) return jsonError('Proyecto obligatorio', 400);
  if (!employeeName) return jsonError('Nombre del empleado obligatorio', 400);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 999) {
    return jsonError('Las horas deben ser un número mayor que 0', 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workedOn)) {
    return jsonError('Fecha de trabajo inválida', 400);
  }

  const admin = getAdminClient();
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id, name, sku')
    .eq('id', projectId)
    .maybeSingle();
  if (projectError) return jsonError(projectError.message, 500);
  if (!project) return jsonError('Proyecto no encontrado', 404);

  const { data, error } = await admin
    .from('time_entries')
    .insert({
      project_id: projectId,
      employee_name: employeeName,
      hours,
      worked_on: workedOn,
      description,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error || !data) return jsonError(error?.message || 'Error creando el registro', 500);
  return jsonOk(timeEntryToApi(data as TimeEntryRow, project), { status: 201 });
}

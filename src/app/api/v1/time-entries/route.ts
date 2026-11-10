import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getProjectInOrg, requireOrg } from '@/lib/server/org';
import { timeEntryToApi, type TimeEntryRow } from '@/lib/server/timeEntries';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const employee = searchParams.get('employee');

  const admin = getAdminClient();
  let query = admin
    .from('time_entries')
    .select('*, project:projects!inner(name, sku, organization_id)')
    .eq('project.organization_id', ctx.organizationId)
    .order('worked_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);
  if (from) query = query.gte('worked_on', from);
  if (to) query = query.lte('worked_on', to);
  if (employee?.trim()) query = query.ilike('employee_name', `%${employee.trim()}%`);

  let { data, error } = await query;
  if (error && /organization_id/i.test(error.message)) {
    let fallback = admin
      .from('time_entries')
      .select('*, project:projects(name, sku)')
      .order('worked_on', { ascending: false })
      .order('created_at', { ascending: false });
    if (projectId) fallback = fallback.eq('project_id', projectId);
    if (from) fallback = fallback.gte('worked_on', from);
    if (to) fallback = fallback.lte('worked_on', to);
    if (employee?.trim()) fallback = fallback.ilike('employee_name', `%${employee.trim()}%`);
    const retry = await fallback;
    data = retry.data;
    error = retry.error;
  }
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
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  const user = ctx.user;

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
  const scoped = await getProjectInOrg(projectId, ctx.organizationId, 'id, name, sku');
  if (scoped.error) return jsonError(scoped.error, 500);
  if (!scoped.data) return jsonError('Proyecto no encontrado', 404);
  const project = scoped.data as { id: string; name: string; sku: string };

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

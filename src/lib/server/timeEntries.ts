import { getAdminClient } from '@/lib/supabase/admin';

export type TimeEntryRow = {
  id: string;
  project_id: string;
  employee_name: string;
  hours: number;
  worked_on: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

export function timeEntryToApi(
  row: TimeEntryRow,
  project?: { name?: string | null; sku?: string | null } | null,
) {
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: project?.name ?? null,
    project_sku: project?.sku ?? null,
    employee_name: row.employee_name,
    hours: Number(row.hours),
    worked_on: row.worked_on,
    description: row.description ?? null,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export async function getTimeEntry(id: string): Promise<TimeEntryRow | null> {
  const admin = getAdminClient();
  const { data, error } = await admin.from('time_entries').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TimeEntryRow | null) ?? null;
}

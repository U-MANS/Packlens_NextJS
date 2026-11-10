import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getProjectInOrg, requireOrg, updateProjectInOrg } from '@/lib/server/org';
import { reloadProject } from '@/lib/server/workflow';
import { isOpsAdminRole } from '@/types';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;

  if (ctx.role !== 'Marketing' && !isOpsAdminRole(ctx.role)) {
    return jsonError('No tienes permiso para discontinuar proyectos', 403);
  }

  const { id } = await context.params;
  const scoped = await getProjectInOrg(id, ctx.organizationId, 'id');
  if (scoped.error) return jsonError(scoped.error, 500);
  if (!scoped.data) return jsonError('Proyecto no encontrado', 404);

  const result = await updateProjectInOrg(id, ctx.organizationId, {
    discontinued: true,
    updated_at: new Date().toISOString(),
  });
  if (result.notFound) return jsonError('Proyecto no encontrado', 404);
  if (result.error) return jsonError(result.error, 500);
  return jsonOk(await reloadProject(id));
}

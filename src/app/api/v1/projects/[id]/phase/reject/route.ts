import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getProjectInOrg, requireOrg } from '@/lib/server/org';
import { canApprovePhase, assertReviewPhase } from '@/lib/server/permissions';
import { isInParallelGate, isParallelReviewPhase } from '@/lib/server/phase';
import { rejectPhase } from '@/lib/server/workflow';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    comment?: string;
    phase?: string | null;
  };
  if (!body.comment?.trim()) return jsonError('El rechazo requiere un comentario', 400);

  const scoped = await getProjectInOrg(id, ctx.organizationId);
  if (scoped.error) return jsonError(scoped.error, 500);
  if (!scoped.data) return jsonError('Proyecto no encontrado', 404);
  const project = scoped.data;

  const projectPhase = project.phase as string;
  const flowType = (project.flow_type as string | null) ?? null;
  const phaseErr = assertReviewPhase(projectPhase);
  if (phaseErr) return jsonError(phaseErr, 400);

  let trackPhase = projectPhase;
  if (isInParallelGate(projectPhase, flowType, ctx.config)) {
    if (body.phase) {
      if (!isParallelReviewPhase(body.phase, ctx.config)) {
        return jsonError(`Vía de rechazo no válida: ${body.phase}`, 400);
      }
      trackPhase = body.phase;
    }
  }

  if (!canApprovePhase(ctx.user, trackPhase, ctx.config)) {
    return jsonError('No tienes permiso para rechazar esta fase', 403);
  }

  const result = await rejectPhase(id, ctx.user, body.comment.trim(), { trackPhase });
  if ('error' in result && result.error) return jsonError(result.error, result.status ?? 400);
  return jsonOk(result.data);
}

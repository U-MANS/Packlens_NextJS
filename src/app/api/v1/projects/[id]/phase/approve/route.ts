import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { canApprovePhase, assertReviewPhase } from '@/lib/server/permissions';
import { approvePhase, getProjectRow } from '@/lib/server/workflow';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { comment?: string | null };

  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);

  const phaseErr = assertReviewPhase(project.phase as string);
  if (phaseErr) return jsonError(phaseErr, 400);
  if (!canApprovePhase(user, project.phase as string)) {
    return jsonError('No tienes permiso para aprobar esta fase', 403);
  }

  const result = await approvePhase(id, user, body.comment);
  if ('error' in result && result.error) return jsonError(result.error, result.status ?? 400);
  return jsonOk(result.data);
}

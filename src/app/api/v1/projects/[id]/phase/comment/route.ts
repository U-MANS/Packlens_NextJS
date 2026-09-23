import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { commentPhase, getProjectRow } from '@/lib/server/workflow';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { comment?: string };
  if (!body.comment?.trim()) return jsonError('El comentario no puede estar vacío', 400);

  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);

  const result = await commentPhase(id, user, body.comment.trim());
  if ('error' in result && result.error) return jsonError(result.error, result.status ?? 400);
  return jsonOk(result.data);
}

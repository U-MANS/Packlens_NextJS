import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import {
  attachmentToRead,
  consumeUploadReservation,
  createAttachmentFromMeta,
  getStorageObjectMeta,
} from '@/lib/server/files';
import { canUploadArteFinal } from '@/lib/server/permissions';
import { addActivity, getProjectRow } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

const ARTE_FINAL_KEY_PREFIX = (projectId: string) => `projects/${projectId}/arte-final/`;

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);
  if (!canUploadArteFinal(user, project.phase as string)) {
    return jsonError('No puedes subir arte final en esta fase', 403);
  }

  const body = (await request.json()) as {
    storage_key?: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  if (!body.storage_key) {
    return jsonError('storage_key requerido', 400);
  }

  const prefix = ARTE_FINAL_KEY_PREFIX(id);
  if (!body.storage_key.startsWith(prefix)) {
    return jsonError('storage_key no pertenece a este proyecto', 400);
  }

  let reservation;
  try {
    reservation = await consumeUploadReservation({
      storage_key: body.storage_key,
      project_id: id,
      user_id: user.id,
      purpose: 'arte_final',
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error validando reserva', 500);
  }
  if (!reservation) {
    return jsonError('Reserva de subida inválida, expirada o ya usada', 409);
  }

  let objectMeta;
  try {
    objectMeta = await getStorageObjectMeta(body.storage_key);
  } catch {
    return jsonError('El archivo no existe en Storage; sube antes de confirmar', 400);
  }

  const fileName = reservation.file_name || body.file_name;
  if (!fileName) {
    return jsonError('file_name no disponible en la reserva', 400);
  }

  const mimeType =
    objectMeta.contentType ||
    reservation.mime_type ||
    'application/octet-stream';

  const att = await createAttachmentFromMeta({
    storage_key: body.storage_key,
    file_name: fileName,
    mime_type: mimeType,
    file_size: objectMeta.size,
  });

  const admin = getAdminClient();
  const { data: arte, error } = await admin
    .from('arte_finals')
    .insert({ project_id: id, attachment_id: att.id, uploaded_by: user.id })
    .select('id')
    .single();
  if (error || !arte) return jsonError(error?.message || 'Error confirmando arte final', 500);

  await addActivity(id, user.id, 'DOCUMENT_UPLOADED', `Arte final subido: ${att.file_name}`);

  return jsonOk(
    {
      id: arte.id,
      project_id: id,
      attachment: await attachmentToRead(att),
      uploaded_by: user.name,
      created_at: new Date().toISOString(),
    },
    { status: 201 },
  );
}

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { attachmentToRead, createAttachmentFromMeta } from '@/lib/server/files';
import { canUploadArteFinal } from '@/lib/server/permissions';
import { addActivity, getProjectRow } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

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
  if (!body.storage_key || !body.file_name) {
    return jsonError('storage_key y file_name requeridos', 400);
  }

  const att = await createAttachmentFromMeta({
    storage_key: body.storage_key,
    file_name: body.file_name,
    mime_type: body.mime_type || 'application/zip',
    file_size: body.file_size || 0,
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

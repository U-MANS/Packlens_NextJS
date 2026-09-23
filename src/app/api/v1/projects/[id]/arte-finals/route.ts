import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import {
  attachmentToRead,
  createAttachmentFromFile,
  createAttachmentFromMeta,
  createSignedUploadUrl,
  generateStorageKey,
} from '@/lib/server/files';
import { canUploadArteFinal } from '@/lib/server/permissions';
import { addActivity, getProjectRow } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

async function arteToRead(arteId: string) {
  const admin = getAdminClient();
  const { data: arte } = await admin
    .from('arte_finals')
    .select('*, uploader:users!arte_finals_uploaded_by_fkey(name), attachment:attachments(*)')
    .eq('id', arteId)
    .single();
  if (!arte) return null;
  return {
    id: arte.id,
    project_id: arte.project_id,
    attachment: await attachmentToRead(arte.attachment),
    uploaded_by: arte.uploader?.name ?? null,
    created_at: arte.created_at,
  };
}

function isZip(file: File) {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return name.endsWith('.zip') || type.includes('zip');
}

export async function GET(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('arte_finals')
    .select('id')
    .eq('project_id', id)
    .order('created_at', { ascending: false });
  if (error) return jsonError(error.message, 500);
  const items = await Promise.all((data ?? []).map((a) => arteToRead(a.id)));
  return jsonOk(items.filter(Boolean));
}

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);
  if (!canUploadArteFinal(user, project.phase as string)) {
    return jsonError('No puedes subir arte final en esta fase', 403);
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return jsonError('Archivo requerido', 400);
  if (!isZip(file)) return jsonError('El arte final debe ser un archivo ZIP (.zip)', 400);

  const att = await createAttachmentFromFile(file, `projects/${id}/arte-final`);
  const admin = getAdminClient();
  const { data: arte, error } = await admin
    .from('arte_finals')
    .insert({ project_id: id, attachment_id: att.id, uploaded_by: user.id })
    .select('id')
    .single();
  if (error || !arte) return jsonError(error?.message || 'Error creando arte final', 500);

  await addActivity(id, user.id, 'DOCUMENT_UPLOADED', `Arte final subido: ${att.file_name}`);
  return jsonOk(await arteToRead(arte.id), { status: 201 });
}

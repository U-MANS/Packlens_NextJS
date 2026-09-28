import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { createAttachmentFromFile, getSignedDownloadUrl, proxyDownloadUrl } from '@/lib/server/files';
import { canManageBriefing } from '@/lib/server/permissions';
import { getProjectRow, reloadProject } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

const MAX_THUMB_BYTES = 5 * 1024 * 1024;

function canManageThumbnail(user: { role: string }, phase: string): boolean {
  if (user.role === 'Admin' || user.role === 'Marketing') return true;
  if (user.role === 'Diseño') return canManageBriefing(user as Parameters<typeof canManageBriefing>[0], phase);
  return false;
}

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);
  if (!canManageThumbnail(user, project.phase as string)) {
    return jsonError('No tienes permisos para subir el thumbnail', 403);
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return jsonError('Archivo de imagen requerido', 400);
  if (!file.type.startsWith('image/')) {
    return jsonError('El thumbnail debe ser una imagen (PNG, JPG, WebP…)', 400);
  }
  if (file.size > MAX_THUMB_BYTES) {
    return jsonError('El thumbnail no puede superar 5 MB', 400);
  }

  const att = await createAttachmentFromFile(file, `projects/${id}/thumbnail`);
  let preview_url: string | null = null;
  try {
    preview_url = await getSignedDownloadUrl(att.storage_key);
  } catch {
    preview_url = proxyDownloadUrl(att.storage_key, att.file_name);
  }

  const thumbnail = {
    id: att.id,
    name: att.file_name,
    size_kb: att.file_size_kb,
    mime_type: att.mime_type,
    storage_key: att.storage_key,
    uploaded_at: new Date().toISOString(),
    preview_url,
    download_url: proxyDownloadUrl(att.storage_key, att.file_name),
  };

  const briefing = {
    ...((project.briefing as Record<string, unknown>) || {}),
    thumbnail,
  };

  const admin = getAdminClient();
  const { error } = await admin.from('projects').update({ briefing }).eq('id', id);
  if (error) return jsonError(error.message, 500);

  return jsonOk(await reloadProject(id));
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);
  if (!canManageThumbnail(user, project.phase as string)) {
    return jsonError('No tienes permisos para eliminar el thumbnail', 403);
  }

  const briefing = { ...((project.briefing as Record<string, unknown>) || {}) };
  delete briefing.thumbnail;

  const admin = getAdminClient();
  const { error } = await admin.from('projects').update({ briefing }).eq('id', id);
  if (error) return jsonError(error.message, 500);

  return jsonOk(await reloadProject(id));
}

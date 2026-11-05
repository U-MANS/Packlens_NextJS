import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { createAttachmentFromFile, getSignedDownloadUrl, proxyDownloadUrl } from '@/lib/server/files';
import { canManageBriefing } from '@/lib/server/permissions';
import { getProjectRow } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';
import { isPublicWorkflowFile } from '@/utils/fileAccess';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);
  if (!canManageBriefing(user, project.phase as string)) {
    return jsonError('No puedes subir archivos de briefing en esta fase', 403);
  }

  const form = await request.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return jsonError('Archivos requeridos', 400);

  const briefing = {
    ...((project.briefing as Record<string, unknown>) || {}),
    files: [...((((project.briefing as { files?: unknown[] }) || {}).files as unknown[]) || [])],
  };

  for (const file of files) {
    const att = await createAttachmentFromFile(file, `projects/${id}/briefing`);
    const proxy = proxyDownloadUrl(att.storage_key, att.file_name);
    const publicFile = isPublicWorkflowFile({
      mimeType: att.mime_type,
      fileName: att.file_name,
      isImage: att.is_image,
      isPdf: att.is_pdf,
    });
    let preview_url: string | null = proxy;
    if (publicFile) {
      try {
        preview_url = await getSignedDownloadUrl(att.storage_key);
      } catch {
        preview_url = proxy;
      }
    }
    (briefing.files as unknown[]).push({
      id: att.id,
      name: att.file_name,
      size_kb: att.file_size_kb,
      mime_type: att.mime_type,
      storage_key: att.storage_key,
      uploaded_at: new Date().toISOString(),
      preview_url,
      download_url: proxy,
    });
  }

  const admin = getAdminClient();
  const { error } = await admin.from('projects').update({ briefing }).eq('id', id);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ files: briefing.files });
}

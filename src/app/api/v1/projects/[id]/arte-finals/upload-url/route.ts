import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { createSignedUploadUrl, generateStorageKey } from '@/lib/server/files';
import { canUploadArteFinal } from '@/lib/server/permissions';
import { getProjectRow } from '@/lib/server/workflow';

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
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  if (!body.file_name) return jsonError('file_name requerido', 400);

  const storage_key = generateStorageKey(`projects/${id}/arte-final`, body.file_name);
  try {
    const signed = await createSignedUploadUrl(storage_key);
    return jsonOk({
      upload_url: signed.upload_url,
      storage_key,
      token: signed.token,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error creando URL de subida', 500);
  }
}

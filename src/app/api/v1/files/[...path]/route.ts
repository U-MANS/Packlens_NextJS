import { NextRequest } from 'next/server';
import { jsonError } from '@/lib/server/http';
import { fetchFileBytes } from '@/lib/server/files';
import { assertStorageKeyInOrg } from '@/lib/server/fileAccessGuard';
import { requireOrg } from '@/lib/server/org';
import { getAdminClient } from '@/lib/supabase/admin';
import { canAccessWorkflowFile } from '@/utils/fileAccess';

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: Ctx) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;

  const { path: parts } = await context.params;
  const storageKey = parts.map(decodeURIComponent).join('/');
  if (!storageKey || storageKey.includes('..')) {
    return jsonError('Ruta de archivo no válida', 400);
  }

  const filenameParam =
    new URL(request.url).searchParams.get('filename') || storageKey.split('/').pop() || 'file';

  // Pertenencia al tenant / proyecto ANTES de leer Storage
  const access = await assertStorageKeyInOrg({
    storageKey,
    organizationId: ctx.organizationId,
    userId: ctx.user.id,
  });
  if (!access.ok) {
    return jsonError(access.message, access.status);
  }

  const admin = getAdminClient();
  const { data: att } = await admin
    .from('attachments')
    .select('file_name, mime_type, is_image, is_pdf')
    .eq('storage_key', storageKey)
    .maybeSingle();

  const fileMeta = {
    mimeType: (att?.mime_type as string | null) ?? null,
    fileName: (att?.file_name as string | null) ?? filenameParam,
    isImage: Boolean(att?.is_image),
    isPdf: Boolean(att?.is_pdf),
  };

  if (att && !canAccessWorkflowFile(ctx.role, fileMeta)) {
    return jsonError(
      'Este archivo solo está disponible para los roles Diseño y Marketing',
      403,
    );
  }

  try {
    const { content, mime } = await fetchFileBytes(storageKey);

    if (
      !att &&
      !canAccessWorkflowFile(ctx.role, {
        mimeType: mime,
        fileName: filenameParam,
      })
    ) {
      return jsonError(
        'Este archivo solo está disponible para los roles Diseño y Marketing',
        403,
      );
    }

    const filename = (att?.file_name as string | undefined) || filenameParam;
    return new Response(new Uint8Array(content), {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Archivo no encontrado', 404);
  }
}

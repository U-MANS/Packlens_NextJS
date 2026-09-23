import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError } from '@/lib/server/http';
import { fetchFileBytes } from '@/lib/server/files';

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { path: parts } = await context.params;
  const storageKey = parts.map(decodeURIComponent).join('/');
  const filename =
    new URL(request.url).searchParams.get('filename') || storageKey.split('/').pop() || 'file';

  try {
    const { content, mime } = await fetchFileBytes(storageKey);
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

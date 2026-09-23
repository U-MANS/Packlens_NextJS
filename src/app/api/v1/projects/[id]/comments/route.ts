import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getProjectRow } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

function mapComment(c: Record<string, unknown>, author?: string | null) {
  return {
    id: c.id,
    project_id: c.project_id,
    document_id: c.document_id ?? null,
    version_id: c.version_id ?? null,
    author: author ?? null,
    role: c.role ?? null,
    text: c.text,
    resolved: Boolean(c.resolved),
    created_at: c.created_at,
  };
}

export async function GET(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const resolved = new URL(request.url).searchParams.get('resolved');
  const admin = getAdminClient();
  let query = admin.from('comments').select('*').eq('project_id', id);
  if (resolved === 'true') query = query.eq('resolved', true);
  if (resolved === 'false') query = query.eq('resolved', false);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return jsonError(error.message, 500);
  return jsonOk((data ?? []).map((c) => mapComment(c)));
}

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);

  const body = (await request.json()) as {
    text: string;
    document_id?: string;
    version_id?: string;
  };

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('comments')
    .insert({
      project_id: id,
      text: body.text,
      document_id: body.document_id ?? null,
      version_id: body.version_id ?? null,
      author_id: user.id,
      role: user.role,
      resolved: false,
    })
    .select('*')
    .single();
  if (error || !data) return jsonError(error?.message || 'Error creando comentario', 500);
  return jsonOk(mapComment(data, user.name), { status: 201 });
}

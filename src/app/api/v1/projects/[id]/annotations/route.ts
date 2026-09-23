import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getProjectRow } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

function mapAnnotation(a: Record<string, unknown>) {
  const position =
    a.position_x != null && a.position_y != null
      ? { x: Number(a.position_x), y: Number(a.position_y) }
      : null;
  return {
    id: a.id,
    project_id: a.project_id,
    proposal_id: a.proposal_id,
    attachment_id: a.attachment_id,
    text: a.text,
    position,
    page: a.page ?? null,
    phase: a.phase,
    author: null,
    role: a.role ?? null,
    created_at: a.created_at,
  };
}

export async function GET(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const proposalId = new URL(request.url).searchParams.get('proposal_id');
  const admin = getAdminClient();
  let query = admin.from('image_annotations').select('*').eq('project_id', id);
  if (proposalId) query = query.eq('proposal_id', proposalId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return jsonError(error.message, 500);
  return jsonOk((data ?? []).map((a) => mapAnnotation(a)));
}

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);

  const body = (await request.json()) as {
    proposal_id: string;
    attachment_id: string;
    text: string;
    position?: { x: number; y: number };
    page?: number;
  };

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('image_annotations')
    .insert({
      project_id: id,
      proposal_id: body.proposal_id,
      attachment_id: body.attachment_id,
      text: body.text,
      position_x: body.position?.x ?? null,
      position_y: body.position?.y ?? null,
      page: body.page ?? null,
      phase: project.phase,
      author_id: user.id,
      role: user.role,
    })
    .select('*')
    .single();
  if (error || !data) return jsonError(error?.message || 'Error creando anotación', 500);
  return jsonOk({ ...mapAnnotation(data), author: user.name }, { status: 201 });
}

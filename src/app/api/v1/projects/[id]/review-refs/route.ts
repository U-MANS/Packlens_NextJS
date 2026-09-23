import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { attachmentToRead, createAttachmentFromFile } from '@/lib/server/files';
import { getProjectRow } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const proposalId = new URL(request.url).searchParams.get('proposal_id');
  if (!proposalId) return jsonError('proposal_id requerido', 400);

  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return jsonError('Archivo requerido', 400);

  const att = await createAttachmentFromFile(file, `projects/${id}/review-refs`);
  const admin = getAdminClient();
  const { data: ref, error } = await admin
    .from('review_ref_attachments')
    .insert({
      project_id: id,
      proposal_id: proposalId,
      attachment_id: att.id,
      author_id: user.id,
    })
    .select('id')
    .single();
  if (error || !ref) return jsonError(error?.message || 'Error creando referencia', 500);

  return jsonOk({
    id: ref.id,
    attachment: await attachmentToRead(att),
  });
}

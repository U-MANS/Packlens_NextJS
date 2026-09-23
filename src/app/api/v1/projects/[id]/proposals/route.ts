import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { attachmentToRead, createAttachmentFromFile } from '@/lib/server/files';
import { canUploadProposal } from '@/lib/server/permissions';
import { PHASE_TO_STATUS } from '@/lib/server/phase';
import { addActivity, getProjectRow } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

async function proposalToRead(proposalId: string) {
  const admin = getAdminClient();
  const { data: proposal } = await admin
    .from('design_proposals')
    .select('*, uploader:users!design_proposals_uploaded_by_fkey(name)')
    .eq('id', proposalId)
    .single();
  if (!proposal) return null;

  const { data: links } = await admin
    .from('design_proposal_attachments')
    .select('attachment_id')
    .eq('proposal_id', proposalId);
  const ids = (links ?? []).map((l) => l.attachment_id);
  let attachments: Awaited<ReturnType<typeof attachmentToRead>>[] = [];
  if (ids.length) {
    const { data: atts } = await admin.from('attachments').select('*').in('id', ids);
    attachments = await Promise.all((atts ?? []).map((a) => attachmentToRead(a)));
  }

  return {
    id: proposal.id,
    project_id: proposal.project_id,
    name: proposal.name,
    version: proposal.version,
    comments: proposal.comments,
    attachments,
    uploaded_by: proposal.uploader?.name ?? null,
    uploaded_role: proposal.uploaded_role,
    uploaded_phase: proposal.uploaded_phase,
    created_at: proposal.created_at,
  };
}

export async function GET(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const admin = getAdminClient();
  const { data: proposals, error } = await admin
    .from('design_proposals')
    .select('id')
    .eq('project_id', id)
    .order('created_at', { ascending: false });
  if (error) return jsonError(error.message, 500);
  const items = await Promise.all((proposals ?? []).map((p) => proposalToRead(p.id)));
  return jsonOk(items.filter(Boolean));
}

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;

  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);
  if (!canUploadProposal(user, project.phase as string)) {
    return jsonError('No puedes subir propuestas en esta fase', 403);
  }

  const form = await request.formData();
  const name = String(form.get('name') ?? '');
  const version = String(form.get('version') ?? '');
  const comments = String(form.get('comments') ?? '');
  if (!name || !version) return jsonError('name y version son obligatorios', 400);

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return jsonError('Se requiere al menos un archivo', 400);

  const admin = getAdminClient();
  const attachments = [];
  for (const file of files) {
    attachments.push(await createAttachmentFromFile(file, `projects/${id}/proposals`));
  }

  const currentPhase = project.phase as string;

  if (currentPhase === 'Aprobación Diseño') {
    const { data: existing } = await admin
      .from('design_proposals')
      .select('*')
      .eq('project_id', id)
      .or('uploaded_phase.eq.Diseño,uploaded_phase.eq.Aprobación Diseño,uploaded_phase.is.null')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      for (const att of attachments) {
        await admin.from('design_proposal_attachments').insert({
          proposal_id: existing.id,
          attachment_id: att.id,
        });
      }
      if (comments) {
        const merged = existing.comments ? `${existing.comments}\n${comments}`.trim() : comments;
        await admin.from('design_proposals').update({ comments: merged }).eq('id', existing.id);
      }
      await addActivity(
        id,
        user.id,
        'DOCUMENT_UPLOADED',
        `Archivos añadidos a la propuesta: ${existing.name} ${existing.version || ''}`.trim(),
      );
      await admin.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', id);
      return jsonOk(await proposalToRead(existing.id), { status: 201 });
    }
  }

  const { data: proposal, error } = await admin
    .from('design_proposals')
    .insert({
      project_id: id,
      name,
      version,
      comments,
      uploaded_by: user.id,
      uploaded_role: user.role,
      uploaded_phase: currentPhase,
    })
    .select('*')
    .single();
  if (error || !proposal) return jsonError(error?.message || 'Error creando propuesta', 500);

  for (const att of attachments) {
    await admin.from('design_proposal_attachments').insert({
      proposal_id: proposal.id,
      attachment_id: att.id,
    });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (currentPhase === 'Creación Desarrollo') {
    updates.phase = 'Validación diseño';
    updates.status = PHASE_TO_STATUS['Validación diseño'];
  } else if (currentPhase === 'Diseño') {
    updates.phase = 'Aprobación Diseño';
    updates.status = PHASE_TO_STATUS['Aprobación Diseño'];
  }
  await admin.from('projects').update(updates).eq('id', id);
  await addActivity(id, user.id, 'DOCUMENT_UPLOADED', `Propuesta subida: ${name} ${version}`);

  return jsonOk(await proposalToRead(proposal.id), { status: 201 });
}

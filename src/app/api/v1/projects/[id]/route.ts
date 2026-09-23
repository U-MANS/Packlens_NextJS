import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { attachmentToRead } from '@/lib/server/files';
import { canManageBriefing } from '@/lib/server/permissions';
import { projectToRead } from '@/lib/server/serializers';
import { getProjectRow, primaryMarket, reloadProject } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

async function mapProposal(proposal: Record<string, unknown> & { id: string; uploader?: { name?: string } }) {
  const admin = getAdminClient();
  const { data: links } = await admin
    .from('design_proposal_attachments')
    .select('attachment_id')
    .eq('proposal_id', proposal.id);
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

  const { data: project, error } = await admin
    .from('projects')
    .select('*, owner_user:users!projects_owner_id_fkey(name)')
    .eq('id', id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!project) return jsonError('Proyecto no encontrado', 404);

  const base = projectToRead(project as Parameters<typeof projectToRead>[0]);

  const [
    { data: designProposals },
    { data: arteFinals },
    { data: phaseActions },
    { data: tasks },
    { data: comments },
    { data: activityEvents },
    { data: imageAnnotations },
  ] = await Promise.all([
    admin
      .from('design_proposals')
      .select('*, uploader:users!design_proposals_uploaded_by_fkey(name)')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    admin
      .from('arte_finals')
      .select('*, uploader:users!arte_finals_uploaded_by_fkey(name), attachment:attachments(*)')
      .eq('project_id', id),
    admin
      .from('phase_actions')
      .select('*, actor:users!phase_actions_actor_id_fkey(name)')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    admin.from('tasks').select('*').eq('project_id', id),
    admin.from('comments').select('*').eq('project_id', id),
    admin
      .from('activity_events')
      .select('*, actor:users!activity_events_actor_id_fkey(name), replies:activity_replies(*, author:users!activity_replies_author_id_fkey(name))')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    admin.from('image_annotations').select('*').eq('project_id', id),
  ]);

  const proposalsMapped = await Promise.all((designProposals ?? []).map((p) => mapProposal(p)));
  const artesMapped = await Promise.all(
    (arteFinals ?? []).map(async (a) => ({
      id: a.id,
      project_id: a.project_id,
      attachment: a.attachment ? await attachmentToRead(a.attachment) : null,
      uploaded_by: a.uploader?.name ?? null,
      created_at: a.created_at,
    })),
  );

  return jsonOk({
    ...base,
    design_proposals: proposalsMapped,
    arte_finals: artesMapped,
    phase_actions: (phaseActions ?? []).map((a) => ({
      id: a.id,
      project_id: a.project_id,
      phase: a.phase,
      type: a.type,
      comment: a.comment,
      actor: a.actor?.name ?? null,
      role: a.role,
      created_at: a.created_at,
    })),
    tasks: tasks ?? [],
    comments: comments ?? [],
    activity_events: (activityEvents ?? []).map((e) => ({
      id: e.id,
      project_id: e.project_id,
      type: e.type,
      text: e.text,
      actor: e.actor?.name ?? null,
      phase_action_id: e.phase_action_id,
      created_at: e.created_at,
      replies: (e.replies ?? []).map((r: Record<string, unknown> & { author?: { name?: string } }) => ({
        id: r.id,
        event_id: r.event_id,
        project_id: r.project_id,
        text: r.text,
        author: r.author?.name ?? null,
        role: r.role,
        created_at: r.created_at,
      })),
    })),
    image_annotations: (imageAnnotations ?? []).map((a) => ({
      id: a.id,
      project_id: a.project_id,
      proposal_id: a.proposal_id,
      attachment_id: a.attachment_id,
      text: a.text,
      position:
        a.position_x != null && a.position_y != null
          ? { x: a.position_x, y: a.position_y }
          : null,
      page: a.page,
      phase: a.phase,
      author: null,
      role: a.role,
      created_at: a.created_at,
    })),
    review_ref_attachments: [],
    documents: [],
  });
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const project = await getProjectRow(id);
  if (!project) return jsonError('Proyecto no encontrado', 404);

  const body = (await request.json()) as Record<string, unknown>;
  const admin = getAdminClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (user.role === 'Diseño') {
    if (!canManageBriefing(user, project.phase as string)) {
      return jsonError('No puedes editar el briefing en esta fase', 403);
    }
    if (body.briefing_notes !== undefined) {
      const briefing = { ...((project.briefing as object) || {}), notes: body.briefing_notes };
      updates.briefing = briefing;
    } else {
      return jsonError('Solo puedes actualizar las notas del briefing', 403);
    }
  } else if (user.role !== 'Marketing' && user.role !== 'Admin') {
    return jsonError('No tienes permisos para editar el proyecto', 403);
  } else {
    for (const field of [
      'name',
      'lifecycle_status',
      'description',
      'target_date',
      'launch_date',
      'art_deadline',
      'product_line',
      'format',
      'design_lead',
      'regulatory_contact',
      'sap_code',
    ]) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (body.sap_code) updates.lifecycle_status = 'Vigente';
    if (body.markets) {
      updates.markets = body.markets;
      const { label, code } = primaryMarket(body.markets as string[]);
      updates.market = label;
      updates.language = code;
    }
    if (body.briefing_notes !== undefined) {
      updates.briefing = {
        ...((project.briefing as object) || {}),
        notes: body.briefing_notes,
      };
    }
  }

  const { error } = await admin.from('projects').update(updates).eq('id', id);
  if (error) return jsonError(error.message, 500);
  return jsonOk(await reloadProject(id));
}

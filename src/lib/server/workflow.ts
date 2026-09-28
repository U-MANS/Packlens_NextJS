import { getAdminClient } from '@/lib/supabase/admin';
import type { DbUser } from '@/lib/server/auth';
import { PHASE_TO_STATUS, nextPhase, prevPhase, isReviewPhase } from '@/lib/server/phase';
import { projectToReadFresh } from '@/lib/server/serializers';

const MARKET_LABELS: Record<string, string> = {
  ES: 'España',
  PT: 'Portugal',
  FR: 'Francia',
  IT: 'Italia',
  DE: 'Alemania',
  UK: 'Reino Unido',
};

export type WorkflowOptions = {
  /** Evita re-disparar el agente (cuando el propio agente aprueba/rechaza). */
  skipAgentTrigger?: boolean;
  agentId?: string | null;
};

export async function getProjectRow(id: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('projects')
    .select('*, owner_user:users!projects_owner_id_fkey(name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function reloadProject(id: string) {
  const row = await getProjectRow(id);
  if (!row) return null;
  return projectToReadFresh(row as Parameters<typeof projectToReadFresh>[0]);
}

async function addActivity(
  projectId: string,
  actorId: string,
  type: string,
  text: string,
  phaseActionId?: string,
) {
  const admin = getAdminClient();
  await admin.from('activity_events').insert({
    project_id: projectId,
    type,
    text,
    actor_id: actorId,
    phase_action_id: phaseActionId ?? null,
  });
}

async function addPhaseAction(
  projectId: string,
  actor: DbUser,
  phase: string,
  type: string,
  comment?: string | null,
  agentId?: string | null,
) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('phase_actions')
    .insert({
      project_id: projectId,
      phase,
      type,
      comment: comment ?? null,
      actor_id: actor.id,
      role: actor.role,
      agent_id: agentId ?? null,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'No se pudo crear phase_action');
  return data;
}

function maybeScheduleAgent(projectId: string, toPhase: string, options?: WorkflowOptions) {
  if (options?.skipAgentTrigger) return;
  if (!isReviewPhase(toPhase) || toPhase === 'Aprobación final') return;
  void import('@/lib/server/agentReview')
    .then(({ schedulePhaseAgent }) => schedulePhaseAgent(projectId))
    .catch((err) => console.error('[agentReview schedule]', projectId, err));
}

export async function approvePhase(
  projectId: string,
  actor: DbUser,
  comment?: string | null,
  options?: WorkflowOptions,
) {
  const admin = getAdminClient();
  const project = await getProjectRow(projectId);
  if (!project) return { error: 'Proyecto no encontrado', status: 404 as const };
  if (!isReviewPhase(project.phase as string)) {
    return { error: `La fase '${project.phase}' no es de revisión`, status: 400 as const };
  }

  const flowType = (project.flow_type as string | null) ?? null;
  const fromPhase = project.phase as string;
  const toPhase = nextPhase(fromPhase, flowType);
  const action = await addPhaseAction(
    projectId,
    actor,
    fromPhase,
    'approve',
    comment,
    options?.agentId,
  );

  const updates: Record<string, unknown> = {
    phase: toPhase,
    status: PHASE_TO_STATUS[toPhase] ?? project.status,
    updated_at: new Date().toISOString(),
  };

  if (toPhase === 'Aprobado') {
    if (project.previous_version_id) {
      updates.lifecycle_status = 'Vigente';
      await admin
        .from('projects')
        .update({ lifecycle_status: 'Obsoleta' })
        .eq('id', project.previous_version_id);
    } else {
      updates.lifecycle_status = 'Pendiente SAP';
    }
  }

  const { error } = await admin.from('projects').update(updates).eq('id', projectId);
  if (error) return { error: error.message, status: 500 as const };

  await addActivity(
    projectId,
    actor.id,
    'REVIEW_APPROVED',
    `Aprobó la fase ${fromPhase}` + (comment ? `: ${comment}` : ''),
    action.id,
  );
  await addActivity(
    projectId,
    actor.id,
    'PHASE_CHANGED',
    `Fase cambiada de ${fromPhase} a ${toPhase}`,
    action.id,
  );

  maybeScheduleAgent(projectId, toPhase, options);

  return { data: await reloadProject(projectId) };
}

export async function rejectPhase(
  projectId: string,
  actor: DbUser,
  comment: string,
  options?: WorkflowOptions,
) {
  const admin = getAdminClient();
  const project = await getProjectRow(projectId);
  if (!project) return { error: 'Proyecto no encontrado', status: 404 as const };
  if (!isReviewPhase(project.phase as string)) {
    return { error: `La fase '${project.phase}' no es de revisión`, status: 400 as const };
  }

  const flowType = (project.flow_type as string | null) ?? null;
  const fromPhase = project.phase as string;
  const toPhase = prevPhase(fromPhase, flowType);
  const action = await addPhaseAction(
    projectId,
    actor,
    fromPhase,
    'reject',
    comment,
    options?.agentId,
  );

  const { error } = await admin
    .from('projects')
    .update({
      phase: toPhase,
      status: 'Cambios solicitados',
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);
  if (error) return { error: error.message, status: 500 as const };

  await addActivity(
    projectId,
    actor.id,
    'REVIEW_REJECTED',
    `Rechazó la fase ${fromPhase}: ${comment}`,
    action.id,
  );
  await addActivity(
    projectId,
    actor.id,
    'PHASE_CHANGED',
    `Fase retrocedida de ${fromPhase} a ${toPhase}`,
    action.id,
  );

  // Tras rechazo se vuelve a fase de trabajo, no de revisión → no dispara agente.

  return { data: await reloadProject(projectId) };
}

export async function commentPhase(projectId: string, actor: DbUser, comment: string) {
  const project = await getProjectRow(projectId);
  if (!project) return { error: 'Proyecto no encontrado', status: 404 as const };

  const action = await addPhaseAction(projectId, actor, project.phase as string, 'comment', comment);
  await addActivity(
    projectId,
    actor.id,
    'COMMENT_ADDED',
    `Comentó en fase ${project.phase}: ${comment}`,
    action.id,
  );

  return {
    data: {
      id: action.id,
      project_id: projectId,
      phase: action.phase,
      type: action.type,
      comment: action.comment,
      actor: actor.name,
      role: actor.role,
      created_at: action.created_at,
    },
  };
}

export function primaryMarket(markets?: string[] | null): { label: string; code: string } {
  if (!markets?.length) return { label: 'España', code: 'ES' };
  const code = markets[0];
  return { label: MARKET_LABELS[code] ?? code, code };
}

export { addActivity, MARKET_LABELS };

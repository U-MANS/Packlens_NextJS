import { getOpenAI } from '@/lib/openai';
import { getAdminClient } from '@/lib/supabase/admin';
import type { DbUser } from '@/lib/server/auth';
import { getSignedDownloadUrl } from '@/lib/server/files';
import { getAgent, type DbAgent } from '@/lib/server/agents';
import { isReviewPhase } from '@/lib/server/phase';
import { approvePhase, rejectPhase, addActivity, getProjectRow } from '@/lib/server/workflow';

const AGENT_PHASE_ROLE: Record<string, 'Marketing' | 'I+D'> = {
  'Aprobación Diseño': 'Marketing',
  'Validación diseño': 'Marketing',
  'Aprobación Legal': 'I+D',
  // Aprobación final: solo humano
};

type AgentDecision = {
  decision: 'approve' | 'reject';
  comment: string;
};

function parseDecision(raw: string): AgentDecision | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned) as { decision?: string; comment?: string };
    if (parsed.decision !== 'approve' && parsed.decision !== 'reject') return null;
    const comment = (parsed.comment ?? '').trim();
    if (!comment) return null;
    return { decision: parsed.decision, comment };
  } catch {
    return null;
  }
}

async function resolveAgentForPhase(
  project: Record<string, unknown>,
  phase: string,
): Promise<DbAgent | null> {
  const neededRole = AGENT_PHASE_ROLE[phase];
  if (!neededRole) return null;

  if (neededRole === 'Marketing') {
    if ((project.marketing_assignee_type as string) !== 'agent') return null;
    const id = project.marketing_agent_id as string | null;
    if (!id) return null;
    const agent = await getAgent(id);
    if (!agent || agent.status !== 'Activo' || agent.role !== 'Marketing') return null;
    return agent;
  }

  if ((project.regulatory_assignee_type as string) !== 'agent') return null;
  const id = project.regulatory_agent_id as string | null;
  if (!id) return null;
  const agent = await getAgent(id);
  if (!agent || agent.status !== 'Activo' || agent.role !== 'I+D') return null;
  return agent;
}

async function collectReviewContext(projectId: string, project: Record<string, unknown>) {
  const admin = getAdminClient();
  const briefing = (project.briefing as Record<string, unknown> | null) ?? {};
  const notes = (briefing.notes as string | null) ?? '';

  const { data: proposals } = await admin
    .from('design_proposals')
    .select('id, name, version, comments, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(3);

  const imageUrls: { label: string; url: string }[] = [];
  const textParts: string[] = [
    `Proyecto: ${project.name} (${project.sku})`,
    `Fase actual: ${project.phase}`,
    `Mercado: ${project.market ?? '—'}`,
    `Línea: ${project.product_line ?? '—'}`,
    `Formato: ${project.format ?? '—'}`,
    notes ? `Notas de briefing:\n${notes}` : 'Sin notas de briefing.',
  ];

  for (const p of proposals ?? []) {
    textParts.push(
      `Propuesta: ${p.name} ${p.version ?? ''}${p.comments ? ` — ${p.comments}` : ''}`,
    );
    const { data: links } = await admin
      .from('design_proposal_attachments')
      .select('attachment_id')
      .eq('proposal_id', p.id);
    const ids = (links ?? []).map((l) => l.attachment_id);
    if (!ids.length) continue;
    const { data: atts } = await admin
      .from('attachments')
      .select('file_name, mime_type, storage_key, is_image')
      .in('id', ids);
    for (const att of atts ?? []) {
      textParts.push(`- Adjunto: ${att.file_name} (${att.mime_type ?? 'unknown'})`);
      if (att.is_image && att.storage_key && imageUrls.length < 4) {
        try {
          const url = await getSignedDownloadUrl(att.storage_key, 60 * 30);
          imageUrls.push({ label: att.file_name, url });
        } catch {
          /* skip */
        }
      }
    }
  }

  return { text: textParts.join('\n'), imageUrls };
}

async function askOpenAI(agent: DbAgent, contextText: string, imageUrls: { label: string; url: string }[]) {
  const openai = getOpenAI();
  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [
    {
      type: 'text',
      text: [
        contextText,
        '',
        'Responde ÚNICAMENTE con un JSON válido (sin markdown) con esta forma exacta:',
        '{"decision":"approve"|"reject","comment":"texto obligatorio explicando la decisión"}',
        'Si faltan datos críticos o hay incumplimientos, usa reject.',
      ].join('\n'),
    },
  ];
  for (const img of imageUrls) {
    userContent.push({ type: 'image_url', image_url: { url: img.url } });
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_AGENT_MODEL?.trim() || 'gpt-4.1-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          agent.prompt,
          '',
          'Eres un revisor de packaging en PackLens. Debes aprobar o rechazar la fase actual.',
          'Tu respuesta debe ser solo JSON con decision y comment.',
        ].join('\n'),
      },
      { role: 'user', content: userContent },
    ],
  });

  return completion.choices[0]?.message?.content ?? '';
}

/** Actor humano proxy para FKs; el texto / agent_id atribuyen al agente. */
async function resolveProxyActor(project: Record<string, unknown>, agent: DbAgent): Promise<DbUser> {
  const admin = getAdminClient();
  const ownerId = project.owner_id as string | undefined;
  if (ownerId) {
    const { data } = await admin.from('users').select('*').eq('id', ownerId).maybeSingle();
    if (data) {
      return { ...(data as DbUser), role: agent.role, name: `Agente · ${agent.name}` };
    }
  }
  const { data: adminUser } = await admin
    .from('users')
    .select('*')
    .eq('role', 'Admin')
    .eq('status', 'Activo')
    .limit(1)
    .maybeSingle();
  if (adminUser) {
    return { ...(adminUser as DbUser), role: agent.role, name: `Agente · ${agent.name}` };
  }
  throw new Error('No hay usuario proxy para ejecutar la acción del agente');
}

async function setReviewRunning(projectId: string, running: boolean) {
  const admin = getAdminClient();
  await admin
    .from('projects')
    .update({ agent_review_running: running, updated_at: new Date().toISOString() })
    .eq('id', projectId);
}

async function logAgentReview(payload: {
  projectId: string;
  agentId: string;
  phase: string;
  decision: 'approve' | 'reject' | 'error';
  comment: string | null;
  raw: string | null;
}) {
  const admin = getAdminClient();
  await admin.from('agent_reviews').insert({
    project_id: payload.projectId,
    agent_id: payload.agentId,
    phase: payload.phase,
    decision: payload.decision,
    comment: payload.comment,
    raw_response: payload.raw,
  });
}

/**
 * Si la fase actual del proyecto corresponde a un agente activo, lo ejecuta.
 * No lanza: errores se registran en activity / agent_reviews.
 */
export async function maybeRunPhaseAgent(projectId: string): Promise<void> {
  const project = await getProjectRow(projectId);
  if (!project) return;

  const phase = project.phase as string;
  if (!isReviewPhase(phase) || phase === 'Aprobación final') return;

  const agent = await resolveAgentForPhase(project as Record<string, unknown>, phase);
  if (!agent) return;

  // Evitar bucles si ya hay una revisión en curso
  if (project.agent_review_running) return;

  await setReviewRunning(projectId, true);
  let raw = '';
  try {
    const ownerId = (project.owner_id as string) || '';
    if (ownerId) {
      await addActivity(
        projectId,
        ownerId,
        'AGENT_REVIEW_STARTED',
        `Agente «${agent.name}» revisando fase ${phase}`,
      );
    }

    const { text, imageUrls } = await collectReviewContext(
      projectId,
      project as Record<string, unknown>,
    );
    raw = await askOpenAI(agent, text, imageUrls);
    const parsed = parseDecision(raw);
    if (!parsed) {
      await logAgentReview({
        projectId,
        agentId: agent.id,
        phase,
        decision: 'error',
        comment: 'Respuesta JSON inválida',
        raw,
      });
      if (ownerId) {
        await addActivity(
          projectId,
          ownerId,
          'AGENT_REVIEW_ERROR',
          `Agente «${agent.name}» no devolvió un JSON válido. La fase permanece en ${phase}.`,
        );
      }
      return;
    }

    const proxy = await resolveProxyActor(project as Record<string, unknown>, agent);
    const comment = `[Agente · ${agent.name}] ${parsed.comment}`;

    if (parsed.decision === 'approve') {
      const result = await approvePhase(projectId, proxy, comment, {
        skipAgentTrigger: true,
        agentId: agent.id,
      });
      if ('error' in result && result.error) {
        throw new Error(result.error);
      }
    } else {
      const result = await rejectPhase(projectId, proxy, comment, {
        skipAgentTrigger: true,
        agentId: agent.id,
      });
      if ('error' in result && result.error) {
        throw new Error(result.error);
      }
    }

    await logAgentReview({
      projectId,
      agentId: agent.id,
      phase,
      decision: parsed.decision,
      comment: parsed.comment,
      raw,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    await logAgentReview({
      projectId,
      agentId: agent.id,
      phase,
      decision: 'error',
      comment: msg,
      raw: raw || null,
    });
    const ownerId = (project.owner_id as string) || '';
    if (ownerId) {
      await addActivity(
        projectId,
        ownerId,
        'AGENT_REVIEW_ERROR',
        `Agente «${agent.name}» falló: ${msg}. La fase permanece en ${phase}.`,
      );
    }
  } finally {
    await setReviewRunning(projectId, false);
  }
}

/** Disparo no bloqueante tras entrar en fase de revisión. */
export function schedulePhaseAgent(projectId: string): void {
  void maybeRunPhaseAgent(projectId).catch((err) => {
    console.error('[agentReview]', projectId, err);
  });
}

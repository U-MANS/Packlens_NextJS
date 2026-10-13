import { env } from '@/lib/env';
import { emailShell, escapeHtml, sendBrevoEmail } from '@/lib/server/email';
import { getAdminClient } from '@/lib/supabase/admin';

type ProjectLike = Record<string, unknown> & {
  id: string;
  name: string;
  sku?: string | null;
  owner_id?: string | null;
  design_lead?: string | null;
  regulatory_contact?: string | null;
  marketing_assignee_type?: string | null;
  regulatory_assignee_type?: string | null;
};

type Recipient = { id: string; email: string; name: string };

/** Quién es el responsable humano de cada fase (agentes no reciben correo). */
function phaseAssigneeKind(
  phase: string,
): 'design' | 'marketing' | 'regulatory' | 'all' | null {
  if (phase === 'Diseño' || phase === 'Creación Desarrollo' || phase === 'Arte final') {
    return 'design';
  }
  if (
    phase === 'Aprobación Diseño' ||
    phase === 'Validación diseño' ||
    phase === 'Aprobación final'
  ) {
    return 'marketing';
  }
  if (phase === 'Aprobación Legal') return 'regulatory';
  if (phase === 'Aprobado') return 'all';
  return null;
}

async function findUserByName(name: string | null | undefined): Promise<Recipient | null> {
  if (!name?.trim()) return null;
  const admin = getAdminClient();
  const { data } = await admin
    .from('users')
    .select('id, email, name')
    .ilike('name', name.trim())
    .eq('status', 'Activo')
    .limit(1)
    .maybeSingle();
  if (!data?.email) return null;
  return { id: data.id as string, email: data.email as string, name: data.name as string };
}

async function findUserById(id: string | null | undefined): Promise<Recipient | null> {
  if (!id) return null;
  const admin = getAdminClient();
  const { data } = await admin
    .from('users')
    .select('id, email, name')
    .eq('id', id)
    .eq('status', 'Activo')
    .maybeSingle();
  if (!data?.email) return null;
  return { id: data.id as string, email: data.email as string, name: data.name as string };
}

async function resolvePhaseRecipients(
  project: ProjectLike,
  phase: string,
  excludeUserId?: string | null,
): Promise<Recipient[]> {
  const byId = new Map<string, Recipient>();
  const add = (r: Recipient | null) => {
    if (!r || !r.email) return;
    if (excludeUserId && r.id === excludeUserId) return;
    byId.set(r.id, r);
  };

  const kind = phaseAssigneeKind(phase);
  const owner = await findUserById(project.owner_id);

  if (kind === 'design' || kind === 'all') {
    add(await findUserByName(project.design_lead as string | null));
  }

  if (kind === 'marketing' || kind === 'all') {
    if ((project.marketing_assignee_type as string) !== 'agent') {
      add(owner);
    }
  }

  if (kind === 'regulatory' || kind === 'all') {
    if ((project.regulatory_assignee_type as string) !== 'agent') {
      add(await findUserByName(project.regulatory_contact as string | null));
    }
  }

  // El owner siempre recibe aviso (salvo si es agente-only y no hay humanos, o es el actor).
  add(owner);

  return [...byId.values()];
}

function projectUrl(projectId: string) {
  return `${env.frontendBaseUrl()}/projects/${projectId}`;
}

async function sendToRecipients(
  recipients: Recipient[],
  subject: string,
  html: string,
): Promise<void> {
  if (!recipients.length) return;
  // Brevo: un correo por destinatario para no revelar emails entre compañeros.
  await Promise.all(
    recipients.map((r) =>
      sendBrevoEmail({
        to: [{ email: r.email, name: r.name }],
        subject,
        html,
      }).then((result) => {
        if (!result.sent) {
          console.error('[phaseEmail]', r.email, result.error);
        }
      }),
    ),
  );
}

/** Aviso al entrar en una fase (aprobación o avance por subida de propuesta). */
export async function notifyPhaseEntered(params: {
  project: ProjectLike;
  toPhase: string;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<void> {
  try {
    const recipients = await resolvePhaseRecipients(
      params.project,
      params.toPhase,
      params.actorId,
    );
    if (!recipients.length) return;

    const url = projectUrl(params.project.id);
    const who = params.actorName ? escapeHtml(params.actorName) : 'Alguien';
    const subject = `PackLens: «${params.project.name}» → ${params.toPhase}`;
    const html = emailShell(
      `Nueva fase: ${params.toPhase}`,
      `<p style="margin:0 0 12px;line-height:1.5;">Hola,</p>
       <p style="margin:0 0 12px;line-height:1.5;">${who} ha avanzado el proyecto <strong>${escapeHtml(params.project.name)}</strong>${params.project.sku ? ` (${escapeHtml(String(params.project.sku))})` : ''} a la fase <strong>${escapeHtml(params.toPhase)}</strong>.</p>
       <p style="margin:0 0 20px;line-height:1.5;">Te toca revisar o trabajar en este paso.</p>`,
      url,
      'Abrir proyecto',
    );

    await sendToRecipients(recipients, subject, html);
  } catch (e) {
    console.error('[notifyPhaseEntered]', e);
  }
}

/** Aviso al rechazar: responsables de la fase a la que vuelve el proyecto. */
export async function notifyPhaseRejected(params: {
  project: ProjectLike;
  fromPhase: string;
  toPhase: string;
  comment: string;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<void> {
  try {
    const recipients = await resolvePhaseRecipients(
      params.project,
      params.toPhase,
      params.actorId,
    );
    if (!recipients.length) return;

    const url = projectUrl(params.project.id);
    const who = params.actorName ? escapeHtml(params.actorName) : 'Alguien';
    const subject = `PackLens: rechazo en «${params.project.name}» (${params.fromPhase})`;
    const html = emailShell(
      `Rechazo en ${params.fromPhase}`,
      `<p style="margin:0 0 12px;line-height:1.5;">Hola,</p>
       <p style="margin:0 0 12px;line-height:1.5;">${who} ha rechazado la fase <strong>${escapeHtml(params.fromPhase)}</strong> del proyecto <strong>${escapeHtml(params.project.name)}</strong>${params.project.sku ? ` (${escapeHtml(String(params.project.sku))})` : ''}.</p>
       <p style="margin:0 0 8px;line-height:1.5;">El proyecto vuelve a <strong>${escapeHtml(params.toPhase)}</strong>.</p>
       <p style="margin:0 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;font-weight:700;">Motivo del rechazo</p>
       <p style="margin:0 0 20px;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(params.comment)}</p>
       <p style="margin:0 0 20px;line-height:1.5;">Revisa los cambios solicitados y vuelve a subir o ajustar lo necesario.</p>`,
      url,
      'Abrir proyecto',
    );

    await sendToRecipients(recipients, subject, html);
  } catch (e) {
    console.error('[notifyPhaseRejected]', e);
  }
}

/** Disparo en segundo plano: no bloquea la API si Brevo falla. */
export function schedulePhaseEntered(
  ...args: Parameters<typeof notifyPhaseEntered>
): void {
  void notifyPhaseEntered(...args);
}

export function schedulePhaseRejected(
  ...args: Parameters<typeof notifyPhaseRejected>
): void {
  void notifyPhaseRejected(...args);
}

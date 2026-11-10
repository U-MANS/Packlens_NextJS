import { getAdminClient } from '@/lib/supabase/admin';
import { getProjectInOrg } from '@/lib/server/org';

const PROJECT_KEY_RE = /^projects\/([0-9a-f-]{36})\//i;
const MOODBOARD_KEY_RE = /^moodboard\/([0-9a-f-]{36})\//i;

/**
 * Resuelve el project_id asociado a un storage_key / attachment.
 * Prefijo projects/{id}/… o joins (proposals, arte_final).
 */
export async function resolveProjectIdForStorageKey(
  storageKey: string
): Promise<string | null> {
  const fromPrefix = storageKey.match(PROJECT_KEY_RE);
  if (fromPrefix?.[1]) return fromPrefix[1];

  const admin = getAdminClient();
  const { data: att } = await admin
    .from('attachments')
    .select('id')
    .eq('storage_key', storageKey)
    .maybeSingle();
  if (!att?.id) return null;

  const { data: proposalLink } = await admin
    .from('design_proposal_attachments')
    .select('proposal_id')
    .eq('attachment_id', att.id)
    .limit(1)
    .maybeSingle();
  if (proposalLink?.proposal_id) {
    const { data: proposal } = await admin
      .from('design_proposals')
      .select('project_id')
      .eq('id', proposalLink.proposal_id)
      .maybeSingle();
    if (proposal?.project_id) return proposal.project_id as string;
  }

  const { data: arte } = await admin
    .from('arte_finals')
    .select('project_id')
    .eq('attachment_id', att.id)
    .limit(1)
    .maybeSingle();
  if (arte?.project_id) return arte.project_id as string;

  return null;
}

/**
 * Autoriza lectura/firma de un storage_key para la org y usuario activos.
 * - projects/{projectId}/… → proyecto en la org
 * - moodboard/{userId}/… → solo el dueño
 * - resto → attachment ligado a proyecto de la org
 * Sin vínculo demostrable → denegar (no descargar a ciegas).
 */
export async function assertStorageKeyInOrg(params: {
  storageKey: string;
  organizationId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; status: 403 | 404; message: string }> {
  const { storageKey, organizationId, userId } = params;

  const mood = storageKey.match(MOODBOARD_KEY_RE);
  if (mood?.[1]) {
    if (mood[1] !== userId) {
      return { ok: false, status: 404, message: 'Archivo no encontrado' };
    }
    return { ok: true };
  }

  const projectId = await resolveProjectIdForStorageKey(storageKey);
  if (!projectId) {
    return { ok: false, status: 404, message: 'Archivo no encontrado' };
  }

  const scoped = await getProjectInOrg(projectId, organizationId, 'id');
  if (scoped.error) {
    return { ok: false, status: 404, message: 'Archivo no encontrado' };
  }
  if (!scoped.data) {
    return { ok: false, status: 404, message: 'Archivo no encontrado' };
  }
  return { ok: true };
}

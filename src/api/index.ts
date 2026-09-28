import { apiFetch, ApiError } from './client';
import {
  mapActivityEvent,
  mapActivityReply,
  mapArteFinal,
  mapComment,
  mapDesignProposal,
  mapImageAnnotation,
  mapPhaseAction,
  mapProject,
  mapTask,
  mergeProjectDetail,
  type ApiActivityEvent,
  type ApiActivityReply,
  type ApiArteFinal,
  type ApiComment,
  type ApiDesignProposal,
  type ApiImageAnnotation,
  type ApiPhaseAction,
  type ApiProject,
  type ApiProjectDetail,
  type ApiTask,
  type ApiUser,
} from './mappers';
import type { Role } from '../types';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function refreshToken(refresh_token: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token }),
  });
}

export async function logoutApi(refresh_token: string): Promise<void> {
  await apiFetch('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token }),
  });
}

export async function getMe(): Promise<ApiUser> {
  return apiFetch<ApiUser>('/auth/me');
}

export interface DebugRegisterPayload {
  name: string;
  email: string;
  password: string;
  role: string;
  initials?: string;
}

export async function debugRegister(payload: DebugRegisterPayload): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/auth/debug/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface UserCreatePayload {
  name: string;
  email: string;
  password: string;
  role: string;
  status?: string;
  initials?: string;
}

export async function listUsers(params?: {
  role?: string;
  status?: string;
  search?: string;
}): Promise<ApiUser[]> {
  const qs = new URLSearchParams();
  if (params?.role) qs.set('role', params.role);
  if (params?.status) qs.set('status', params.status);
  if (params?.search) qs.set('search', params.search);
  const query = qs.toString();
  return apiFetch<ApiUser[]>(`/users${query ? `?${query}` : ''}`);
}

export async function createUser(payload: UserCreatePayload): Promise<ApiUser> {
  return apiFetch<ApiUser>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface UserUpdatePayload {
  name?: string;
  role?: string;
  status?: string;
  initials?: string;
}

export async function updateUser(id: string, payload: UserUpdatePayload): Promise<ApiUser> {
  return apiFetch<ApiUser>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(id: string): Promise<void> {
  await apiFetch(`/users/${id}`, { method: 'DELETE' });
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export type AgentRole = 'Marketing' | 'I+D';

export interface ApiAgent {
  id: string;
  name: string;
  prompt: string;
  role: AgentRole;
  status: 'Activo' | 'Inactivo';
  created_at: string;
  updated_at: string;
}

export interface AgentCreatePayload {
  name: string;
  prompt: string;
  role: AgentRole;
  status?: 'Activo' | 'Inactivo';
}

export interface AgentUpdatePayload {
  name?: string;
  prompt?: string;
  role?: AgentRole;
  status?: 'Activo' | 'Inactivo';
}

export async function listAgents(params?: {
  role?: string;
  status?: string;
}): Promise<ApiAgent[]> {
  const q = new URLSearchParams();
  if (params?.role) q.set('role', params.role);
  if (params?.status) q.set('status', params.status);
  const query = q.toString();
  return apiFetch<ApiAgent[]>(`/agents${query ? `?${query}` : ''}`);
}

export async function createAgent(payload: AgentCreatePayload): Promise<ApiAgent> {
  return apiFetch<ApiAgent>('/agents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAgent(id: string, payload: AgentUpdatePayload): Promise<ApiAgent> {
  return apiFetch<ApiAgent>(`/agents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAgent(id: string): Promise<void> {
  await apiFetch(`/agents/${id}`, { method: 'DELETE' });
}

// ─── Invitations ─────────────────────────────────────────────────────────────

export interface ApiInvitation {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  status: string;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  invited_by_name?: string | null;
}

export interface InvitationCreatePayload {
  email: string;
  role: string;
  name?: string;
}

export interface InvitationCreateResponse {
  invitation: ApiInvitation;
  email_sent: boolean;
  email_message_id?: string | null;
  email_error?: string | null;
}

export interface InvitePreview {
  email: string;
  role: string;
  name?: string | null;
  expires_at: string;
  inviter_name: string;
}

export async function listInvitations(): Promise<ApiInvitation[]> {
  return apiFetch<ApiInvitation[]>('/users/invitations');
}

export async function createInvitation(
  payload: InvitationCreatePayload,
): Promise<InvitationCreateResponse> {
  return apiFetch<InvitationCreateResponse>('/users/invitations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function revokeInvitation(id: string): Promise<void> {
  await apiFetch(`/users/invitations/${id}`, { method: 'DELETE' });
}

export async function resendInvitation(id: string): Promise<InvitationCreateResponse> {
  return apiFetch<InvitationCreateResponse>(`/users/invitations/${id}/resend`, {
    method: 'POST',
  });
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  return apiFetch<InvitePreview>(`/invites/${encodeURIComponent(token)}`);
}

export async function acceptInvite(
  token: string,
  payload: { password: string; name?: string },
): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(`/invites/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface ProjectCreatePayload {
  name: string;
  sku: string;
  flow_type?: string;
  product_line?: string;
  format?: string;
  markets?: string[];
  label_languages?: string[];
  label_languages_front?: string[];
  label_languages_back?: string[];
  launch_date?: string;
  art_deadline?: string;
  owner_name?: string;
  design_lead?: string;
  regulatory_contact?: string;
  assignee_user_ids?: string[];
  marketing_assignee_type?: 'user' | 'agent';
  marketing_agent_id?: string;
  regulatory_assignee_type?: 'user' | 'agent';
  regulatory_agent_id?: string;
  description?: string;
  briefing_notes?: string;
  briefing_refs?: { id: string; name: string; sku: string }[];
  source_project_id?: string;
  substitution_type?: string;
  temporal_end_date?: string;
}

export async function listProjects(params?: Record<string, string>): Promise<ApiProject[]> {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  return apiFetch<ApiProject[]>(`/projects${qs}`);
}

export async function getProject(id: string): Promise<ApiProjectDetail> {
  return apiFetch<ApiProjectDetail>(`/projects/${id}`);
}

export async function createProject(payload: ProjectCreatePayload): Promise<ApiProject> {
  return apiFetch<ApiProject>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProjectApi(
  id: string,
  patch: Record<string, unknown>,
): Promise<ApiProject> {
  return apiFetch<ApiProject>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function archiveProject(id: string): Promise<ApiProject> {
  return apiFetch<ApiProject>(`/projects/${id}/archive`, { method: 'POST' });
}

export async function discontinueProject(id: string): Promise<ApiProject> {
  return apiFetch<ApiProject>(`/projects/${id}/discontinue`, { method: 'POST' });
}

export async function createProjectVersion(
  id: string,
  substitution_type?: string,
  temporal_end_date?: string,
): Promise<ApiProject> {
  const params = new URLSearchParams();
  if (substitution_type) params.set('substitution_type', substitution_type);
  if (temporal_end_date) params.set('temporal_end_date', temporal_end_date);
  const qs = params.toString() ? `?${params}` : '';
  return apiFetch<ApiProject>(`/projects/${id}/versions${qs}`, { method: 'POST' });
}

export async function uploadBriefingFiles(projectId: string, files: File[]): Promise<void> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  await apiFetch(`/projects/${projectId}/briefing-files`, {
    method: 'POST',
    body: form,
  });
}

export async function uploadProjectThumbnail(projectId: string, file: File): Promise<ApiProject> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<ApiProject>(`/projects/${projectId}/thumbnail`, {
    method: 'POST',
    body: form,
  });
}

export async function deleteProjectThumbnail(projectId: string): Promise<ApiProject> {
  return apiFetch<ApiProject>(`/projects/${projectId}/thumbnail`, {
    method: 'DELETE',
  });
}

// ─── Workflow ────────────────────────────────────────────────────────────────

export async function approvePhase(projectId: string, comment?: string): Promise<ApiProject> {
  return apiFetch<ApiProject>(`/projects/${projectId}/phase/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment: comment ?? null }),
  });
}

export async function rejectPhase(projectId: string, comment: string): Promise<ApiProject> {
  return apiFetch<ApiProject>(`/projects/${projectId}/phase/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export async function commentPhase(projectId: string, comment: string): Promise<ApiPhaseAction> {
  return apiFetch<ApiPhaseAction>(`/projects/${projectId}/phase/comment`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

// ─── Proposals ───────────────────────────────────────────────────────────────

export async function createProposal(
  projectId: string,
  name: string,
  version: string,
  comments: string,
  files: File[],
): Promise<ApiDesignProposal> {
  const form = new FormData();
  form.append('name', name);
  form.append('version', version);
  form.append('comments', comments);
  files.forEach((f) => form.append('files', f));
  return apiFetch<ApiDesignProposal>(`/projects/${projectId}/proposals`, {
    method: 'POST',
    body: form,
  });
}

// ─── Arte final ──────────────────────────────────────────────────────────────

export async function prepareArteFinalUpload(
  projectId: string,
  file: File,
): Promise<{ upload_url: string; storage_key: string; token?: string | null }> {
  return apiFetch(`/projects/${projectId}/arte-finals/upload-url`, {
    method: 'POST',
    body: JSON.stringify({
      file_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
    }),
  });
}

export async function confirmArteFinalUpload(
  projectId: string,
  payload: {
    storage_key: string;
    file_name: string;
    mime_type: string;
    file_size: number;
  },
): Promise<ApiArteFinal> {
  return apiFetch<ApiArteFinal>(`/projects/${projectId}/arte-finals/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Sube el arte final / master directo a Supabase y confirma en la API. */
export async function uploadArteFinal(projectId: string, file: File): Promise<ApiArteFinal> {
  try {
    const prepared = await prepareArteFinalUpload(projectId, file);
    const putHeaders: Record<string, string> = {
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    };
    if (prepared.token) {
      putHeaders.Authorization = `Bearer ${prepared.token}`;
    }

    const putRes = await fetch(prepared.upload_url, {
      method: 'PUT',
      headers: putHeaders,
      body: file,
    });
    if (!putRes.ok) {
      const detail = await putRes.text().catch(() => '');
      if (putRes.status === 413) {
        throw new ApiError(
          'El archivo supera el límite de Supabase Storage. ' +
            'Revisa Storage → Settings (Global file size limit) y el bucket packlens-files.',
          413,
          detail,
        );
      }
      let message = detail || `Error al subir el archivo a Storage (${putRes.status})`;
      try {
        const parsed = JSON.parse(detail) as { message?: string; error?: string };
        if (parsed.message) message = parsed.message;
        else if (parsed.error) message = parsed.error;
      } catch {
        /* texto plano */
      }
      throw new ApiError(message, putRes.status, detail);
    }

    return confirmArteFinalUpload(projectId, {
      storage_key: prepared.storage_key,
      file_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
    });
  } catch (e) {
    // Fallback multipart (archivos pequeños / entornos sin signed upload)
    if (e instanceof ApiError && (e.status === 501 || e.status === 404)) {
      const form = new FormData();
      form.append('file', file);
      return apiFetch<ApiArteFinal>(`/projects/${projectId}/arte-finals`, {
        method: 'POST',
        body: form,
      });
    }
    throw e;
  }
}

// ─── Annotations ─────────────────────────────────────────────────────────────

export async function createAnnotation(
  projectId: string,
  body: {
    proposal_id: string;
    attachment_id: string;
    text: string;
    position?: { x: number; y: number };
    page?: number;
  },
): Promise<ApiImageAnnotation> {
  return apiFetch<ApiImageAnnotation>(`/projects/${projectId}/annotations`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteAnnotation(id: string): Promise<void> {
  await apiFetch(`/annotations/${id}`, { method: 'DELETE' });
}

export async function uploadReviewRef(
  projectId: string,
  proposalId: string,
  file: File,
): Promise<{ id: string; attachment: import('./mappers').ApiAttachment }> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch(`/projects/${projectId}/review-refs?proposal_id=${proposalId}`, {
    method: 'POST',
    body: form,
  });
}

export async function deleteReviewRef(id: string): Promise<void> {
  await apiFetch(`/review-refs/${id}`, { method: 'DELETE' });
}

// ─── Tasks & comments ────────────────────────────────────────────────────────

export async function createTask(
  projectId: string,
  payload: {
    title: string;
    role?: string;
    priority?: string;
    due_date?: string | null;
  },
): Promise<ApiTask> {
  return apiFetch<ApiTask>(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function toggleTaskApi(
  taskId: string,
  status: 'Pendiente' | 'Completada',
): Promise<ApiTask> {
  return apiFetch<ApiTask>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function createComment(
  projectId: string,
  text: string,
): Promise<ApiComment> {
  return apiFetch<ApiComment>(`/projects/${projectId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function resolveCommentApi(commentId: string): Promise<ApiComment> {
  return apiFetch<ApiComment>(`/comments/${commentId}/resolve`, { method: 'PATCH' });
}

// ─── Activity ────────────────────────────────────────────────────────────────

export async function listActivity(projectId: string): Promise<ApiActivityEvent[]> {
  return apiFetch<ApiActivityEvent[]>(`/projects/${projectId}/activity`);
}

export async function createActivityReply(
  eventId: string,
  text: string,
): Promise<ApiActivityReply> {
  return apiFetch<ApiActivityReply>(`/activity/${eventId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  project_id: string | null;
  read_at: string | null;
  created_at: string;
  is_read: boolean;
}

export interface NotificationListResponse {
  items: ApiNotification[];
  unread_count: number;
}

export async function listNotifications(limit = 50): Promise<NotificationListResponse> {
  return apiFetch<NotificationListResponse>(`/notifications?limit=${limit}`);
}

export async function markAllNotificationsRead(): Promise<{ marked: number }> {
  return apiFetch<{ marked: number }>('/notifications/mark-all-read', { method: 'POST' });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardRecent(): Promise<ApiProject[]> {
  return apiFetch<ApiProject[]>('/dashboard/recent');
}

// ─── Catalogs ────────────────────────────────────────────────────────────────

export async function getProductLines(): Promise<string[]> {
  return apiFetch<string[]>('/catalogs/product-lines');
}

export async function getMarkets(): Promise<{ code: string; label: string }[]> {
  return apiFetch('/catalogs/markets');
}

export async function getLanguages(): Promise<string[]> {
  return apiFetch<string[]>('/catalogs/languages');
}

// ─── Moodboard IA ────────────────────────────────────────────────────────────

export interface MoodboardProposal {
  id: string;
  label: string;
  url: string;
  storage_key: string | null;
  revised_prompt: string | null;
}

export interface MoodboardResponse {
  prompt: string;
  proposals: MoodboardProposal[];
  model: string;
  used_references?: number;
  created_at: string;
}

export async function generateMoodboard(
  prompt: string,
  references: File[] = [],
): Promise<MoodboardResponse> {
  if (references.length > 0) {
    const form = new FormData();
    form.append('prompt', prompt);
    for (const file of references) {
      form.append('references', file);
    }
    return apiFetch<MoodboardResponse>('/moodboard/generate', {
      method: 'POST',
      body: form,
    });
  }

  return apiFetch<MoodboardResponse>('/moodboard/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

// Re-export mappers for convenience
export {
  mapProject,
  mapDesignProposal,
  mapArteFinal,
  mapPhaseAction,
  mapTask,
  mapComment,
  mapActivityEvent,
  mapActivityReply,
  mapImageAnnotation,
  mergeProjectDetail,
};

export type { ApiUser, Role };

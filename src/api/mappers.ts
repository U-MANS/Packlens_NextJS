import type {
  ActivityEvent,
  ActivityReply,
  ArteFinal,
  Comment,
  DesignProposal,
  ImageAnnotation,
  PhaseAction,
  Project,
  ProjectAttachment,
  ProjectBriefing,
  Task,
} from '../types';
import { apiUrl } from './client';

// ─── API response shapes (snake_case from FastAPI) ───────────────────────────

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  initials?: string | null;
  joined_at?: string | null;
  created_at: string;
}

export interface ApiAttachment {
  id: string;
  file_name: string;
  mime_type?: string | null;
  file_size_kb?: number | null;
  storage_key: string;
  is_image: boolean;
  is_pdf: boolean;
  is_zip: boolean;
  page_count?: number | null;
  created_at: string;
  preview_url?: string | null;
  download_url?: string | null;
}

export interface ApiProject {
  id: string;
  name: string;
  sku: string;
  market?: string | null;
  language?: string | null;
  flow_type?: string | null;
  status: string;
  phase: string;
  owner?: string | null;
  target_date?: string | null;
  description?: string | null;
  created_at: string;
  archived: boolean;
  lifecycle_status: string;
  sap_code?: string | null;
  version: number;
  previous_version_id?: string | null;
  substitution_type?: string | null;
  temporal_end_date?: string | null;
  discontinued: boolean;
  product_line?: string | null;
  format?: string | null;
  markets?: string[] | null;
  label_languages?: string[] | null;
  label_languages_front?: string[] | null;
  label_languages_back?: string[] | null;
  launch_date?: string | null;
  art_deadline?: string | null;
  regulatory_contact?: string | null;
  design_lead?: string | null;
  briefing?: Record<string, unknown> | null;
  thumbnail?: Record<string, unknown> | null;
}

export interface ApiProjectDetail extends ApiProject {
  design_proposals?: ApiDesignProposal[];
  arte_finals?: ApiArteFinal[];
  phase_actions?: ApiPhaseAction[];
  tasks?: ApiTask[];
  comments?: ApiComment[];
  activity_events?: ApiActivityEvent[];
  image_annotations?: ApiImageAnnotation[];
}

export interface ApiDesignProposal {
  id: string;
  project_id: string;
  name: string;
  version?: string | null;
  comments?: string | null;
  attachments: ApiAttachment[];
  uploaded_by?: string | null;
  uploaded_role?: string | null;
  uploaded_phase?: string | null;
  created_at: string;
}

export interface ApiArteFinal {
  id: string;
  project_id: string;
  attachment: ApiAttachment;
  uploaded_by?: string | null;
  created_at: string;
}

export interface ApiPhaseAction {
  id: string;
  project_id: string;
  phase: string;
  type: string;
  comment?: string | null;
  actor?: string | null;
  role?: string | null;
  created_at: string;
}

export interface ApiTask {
  id: string;
  project_id: string;
  title: string;
  owner?: string | null;
  role?: string | null;
  status: string;
  priority: string;
  due_date?: string | null;
}

export interface ApiComment {
  id: string;
  project_id: string;
  document_id?: string | null;
  version_id?: string | null;
  author?: string | null;
  role?: string | null;
  text: string;
  resolved: boolean;
  created_at: string;
}

export interface ApiActivityEvent {
  id: string;
  project_id: string;
  type: string;
  text: string;
  actor?: string | null;
  phase_action_id?: string | null;
  created_at: string;
  replies?: ApiActivityReply[];
}

export interface ApiActivityReply {
  id: string;
  event_id: string;
  project_id: string;
  text: string;
  author?: string | null;
  role?: string | null;
  created_at: string;
}

export interface ApiImageAnnotation {
  id: string;
  project_id: string;
  proposal_id: string;
  attachment_id: string;
  text: string;
  position?: { x: number; y: number } | null;
  page?: number | null;
  phase: string;
  author?: string | null;
  role?: string | null;
  created_at: string;
}

// ─── URL resolver ────────────────────────────────────────────────────────────

export function resolveFileUrl(downloadUrl?: string | null): string {
  if (!downloadUrl) return '';
  if (downloadUrl.startsWith('http') || downloadUrl.startsWith('data:')) {
    return downloadUrl;
  }
  const base = apiUrl('').replace(/\/api\/v1\/?$/, '');
  return `${base}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
}

function proxyDownloadPath(storageKey: string, fileName: string): string {
  return `/api/v1/files/${storageKey}?filename=${encodeURIComponent(fileName)}`;
}

/** Separa URL de previsualización (firmada) y descarga (proxy API). */
export function mapFileAccessUrls(
  storageKey: string,
  fileName: string,
  previewUrl?: string | null,
  downloadUrl?: string | null,
): { dataUrl: string; downloadUrl: string } {
  const proxy = resolveFileUrl(
    downloadUrl?.includes('/api/v1/files') ? downloadUrl : proxyDownloadPath(storageKey, fileName),
  );
  const legacySigned =
    !previewUrl &&
    downloadUrl &&
    downloadUrl.startsWith('http') &&
    !downloadUrl.includes('/api/v1/files');
  const preview = resolveFileUrl(previewUrl ?? (legacySigned ? downloadUrl : null) ?? proxy);
  return { dataUrl: preview, downloadUrl: proxy };
}

function mapBriefing(raw: Record<string, unknown> | null | undefined): ProjectBriefing | undefined {
  if (!raw) return undefined;
  const rawFiles = (raw.files as Array<Record<string, unknown>> | undefined) ?? [];
  const files = rawFiles.map((f) => {
    const storageKey = (f.storage_key as string | undefined) ?? '';
    const name = (f.name as string) ?? '';
    const { dataUrl, downloadUrl } = mapFileAccessUrls(
      storageKey,
      name,
      (f.preview_url as string | undefined) ?? null,
      (f.download_url as string | undefined) ?? null,
    );
    return {
      name,
      sizeKb: (f.size_kb as number) ?? (f.sizeKb as number) ?? 0,
      mimeType: (f.mime_type as string) ?? (f.mimeType as string) ?? 'application/octet-stream',
      dataUrl,
      downloadUrl,
    };
  });
  const legacyPreview = resolveFileUrl(
    (raw.preview_url as string | undefined) ??
      (raw.dataUrl as string | undefined) ??
      (raw.download_url as string | undefined),
  );
  return {
    files: files.length > 0 ? files : undefined,
    notes: (raw.notes as string | undefined) ?? undefined,
    refs: (raw.refs as ProjectBriefing['refs']) ?? undefined,
    uploadedAt: (raw.uploaded_at as string | undefined) ?? (raw.uploadedAt as string | undefined),
    fileName: (raw.fileName as string | undefined) ?? undefined,
    fileSizeKb: (raw.fileSizeKb as number | undefined) ?? undefined,
    dataUrl: legacyPreview || undefined,
    mimeType: (raw.mimeType as string | undefined) ?? undefined,
  };
}

// ─── Mappers API → frontend types ────────────────────────────────────────────

export function mapAttachment(a: ApiAttachment): ProjectAttachment {
  const { dataUrl, downloadUrl } = mapFileAccessUrls(
    a.storage_key,
    a.file_name,
    a.preview_url,
    a.download_url,
  );
  return {
    id: a.id,
    fileName: a.file_name,
    mimeType: a.mime_type ?? 'application/octet-stream',
    fileSizeKb: a.file_size_kb ?? 0,
    dataUrl,
    downloadUrl,
    isImage: a.is_image,
    isVideo: (a.mime_type ?? '').startsWith('video/'),
    isPdf: a.is_pdf,
    isZip: a.is_zip,
    pageCount: a.page_count ?? undefined,
    createdAt: a.created_at,
  };
}

function mapThumbnail(raw: Record<string, unknown> | null | undefined): Project['thumbnail'] {
  if (!raw) return undefined;
  const storageKey = (raw.storage_key as string | undefined) ?? '';
  const fileName = (raw.name as string) ?? (raw.file_name as string) ?? 'thumbnail';
  const { dataUrl, downloadUrl } = mapFileAccessUrls(
    storageKey,
    fileName,
    (raw.preview_url as string | undefined) ?? null,
    (raw.download_url as string | undefined) ?? null,
  );
  if (!dataUrl && !storageKey) return undefined;
  return {
    id: (raw.id as string) ?? storageKey,
    fileName,
    mimeType: (raw.mime_type as string) ?? 'image/jpeg',
    fileSizeKb: (raw.size_kb as number) ?? (raw.file_size_kb as number) ?? 0,
    dataUrl,
    downloadUrl,
    uploadedAt: (raw.uploaded_at as string | undefined) ?? undefined,
  };
}

export function mapProject(p: ApiProject): Project {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    market: p.market ?? '',
    language: p.language ?? '',
    flowType: (p.flow_type as Project['flowType']) ?? undefined,
    status: p.status as Project['status'],
    phase: p.phase as Project['phase'],
    owner: p.owner ?? '',
    targetDate: p.target_date ?? p.created_at,
    description: p.description ?? '',
    createdAt: p.created_at,
    archived: p.archived,
    lifecycleStatus: p.lifecycle_status as Project['lifecycleStatus'],
    sapCode: p.sap_code ?? undefined,
    version: p.version,
    previousVersionId: p.previous_version_id ?? undefined,
    substitutionType: (p.substitution_type as Project['substitutionType']) ?? undefined,
    temporalEndDate: p.temporal_end_date ?? undefined,
    discontinued: p.discontinued,
    productLine: p.product_line ?? undefined,
    format: p.format ?? undefined,
    markets: p.markets ?? undefined,
    labelLanguages: p.label_languages ?? undefined,
    labelLanguagesFront: p.label_languages_front ?? undefined,
    labelLanguagesBack: p.label_languages_back ?? undefined,
    launchDate: p.launch_date ?? undefined,
    artDeadline: p.art_deadline ?? undefined,
    regulatoryContact: p.regulatory_contact ?? undefined,
    designLead: p.design_lead ?? undefined,
    briefing: mapBriefing(p.briefing as Record<string, unknown> | null | undefined),
    thumbnail: mapThumbnail(p.thumbnail as Record<string, unknown> | null | undefined),
  };
}

export function mapDesignProposal(p: ApiDesignProposal): DesignProposal {
  return {
    id: p.id,
    projectId: p.project_id,
    name: p.name,
    version: p.version ?? '',
    comments: p.comments ?? '',
    attachments: (p.attachments ?? []).map(mapAttachment),
    uploadedBy: p.uploaded_by ?? '',
    uploadedRole: (p.uploaded_role as DesignProposal['uploadedRole']) ?? 'Diseño',
    uploadedPhase: (p.uploaded_phase as DesignProposal['uploadedPhase']) ?? undefined,
    createdAt: p.created_at,
  };
}

export function mapArteFinal(a: ApiArteFinal): ArteFinal {
  return {
    id: a.id,
    projectId: a.project_id,
    attachment: mapAttachment(a.attachment),
    uploadedBy: a.uploaded_by ?? '',
    createdAt: a.created_at,
  };
}

export function mapPhaseAction(a: ApiPhaseAction): PhaseAction {
  return {
    id: a.id,
    projectId: a.project_id,
    phase: a.phase as PhaseAction['phase'],
    type: a.type as PhaseAction['type'],
    comment: a.comment ?? undefined,
    actor: a.actor ?? '',
    role: (a.role as PhaseAction['role']) ?? 'Marketing',
    createdAt: a.created_at,
  };
}

export function mapTask(t: ApiTask): Task {
  return {
    id: t.id,
    projectId: t.project_id,
    title: t.title,
    owner: t.owner ?? '',
    role: (t.role as Task['role']) ?? 'Marketing',
    status: t.status as Task['status'],
    priority: t.priority as Task['priority'],
    dueDate: t.due_date ?? '',
  };
}

export function mapComment(c: ApiComment): Comment {
  return {
    id: c.id,
    projectId: c.project_id,
    documentId: c.document_id ?? undefined,
    versionId: c.version_id ?? undefined,
    author: c.author ?? '',
    role: (c.role as Comment['role']) ?? 'Marketing',
    text: c.text,
    resolved: c.resolved,
    createdAt: c.created_at,
  };
}

export function mapActivityEvent(e: ApiActivityEvent): ActivityEvent {
  return {
    id: e.id,
    projectId: e.project_id,
    type: e.type as ActivityEvent['type'],
    text: e.text,
    actor: e.actor ?? '',
    createdAt: e.created_at,
    phaseActionId: e.phase_action_id ?? undefined,
  };
}

export function mapActivityReply(r: ApiActivityReply): ActivityReply {
  return {
    id: r.id,
    eventId: r.event_id,
    projectId: r.project_id,
    text: r.text,
    author: r.author ?? '',
    role: (r.role as ActivityReply['role']) ?? 'Marketing',
    createdAt: r.created_at,
  };
}

export function mapImageAnnotation(a: ApiImageAnnotation): ImageAnnotation {
  return {
    id: a.id,
    projectId: a.project_id,
    proposalId: a.proposal_id,
    attachmentId: a.attachment_id,
    text: a.text,
    position: a.position ?? undefined,
    page: a.page ?? undefined,
    phase: a.phase as ImageAnnotation['phase'],
    author: a.author ?? '',
    role: (a.role as ImageAnnotation['role']) ?? 'Marketing',
    createdAt: a.created_at,
  };
}

export function mergeProjectDetail(detail: ApiProjectDetail) {
  const project = mapProject(detail);
  const proposals = (detail.design_proposals ?? []).map(mapDesignProposal);
  const arteFinals = (detail.arte_finals ?? []).map(mapArteFinal);
  const phaseActions = (detail.phase_actions ?? []).map(mapPhaseAction);
  const tasks = (detail.tasks ?? []).map(mapTask);
  const comments = (detail.comments ?? []).map(mapComment);
  const activity = (detail.activity_events ?? []).map(mapActivityEvent);
  const annotations = (detail.image_annotations ?? []).map(mapImageAnnotation);
  const replies = (detail.activity_events ?? []).flatMap((e) =>
    (e.replies ?? []).map(mapActivityReply),
  );
  return { project, proposals, arteFinals, phaseActions, tasks, comments, activity, annotations, replies };
}

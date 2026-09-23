export type Role =
  | 'Marketing'
  | 'Diseño'
  | 'I+D'
  | 'Admin'
  | 'Comercial';

export type LifecycleStatus =
  | 'Borrador'
  | 'Pendiente SAP'
  | 'Vigente'
  | 'Temporal'
  | 'Obsoleta';

export type ProjectStatus =
  | 'En diseño'
  | 'En aprobación diseño'
  | 'En creación desarrollo'
  | 'En validación diseño'
  | 'En aprobación legal'
  | 'En arte final'
  | 'En aprobación final'
  | 'Aprobado'
  | 'Archivado'
  | 'Cambios solicitados'
  | 'Rechazado';

export type ProjectPhase =
  | 'Diseño'
  | 'Aprobación Diseño'
  | 'Creación Desarrollo'
  | 'Validación diseño'
  | 'Aprobación Legal'
  | 'Arte final'
  | 'Aprobación final'
  | 'Aprobado';

export interface BriefingFile {
  name: string;
  sizeKb: number;
  /** URL de previsualización (firmada o local). */
  dataUrl: string;
  /** Descarga segura vía API. */
  downloadUrl?: string;
  mimeType: string;
}

export interface ProjectBriefing {
  /** Archivos adjuntos del briefing (uno o varios). */
  files?: BriefingFile[];
  uploadedAt?: string;
  notes?: string;
  /** Proyectos referenciados como inspiración / base del briefing. */
  refs?: { id: string; name: string; sku: string }[];
  /** @deprecated Legacy single-file fields — mantenidos por compatibilidad */
  fileName?: string;
  fileSizeKb?: number;
  dataUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
}

export type FlowType = 'Nacional' | 'Exportación' | 'Marca Blanca';

export interface Project {
  id: string;
  name: string;
  sku: string;
  market: string;
  /** Tipo de flujo de aprobación: Nacional, Exportación o Marca Blanca. */
  flowType?: FlowType;
  language: string;
  status: ProjectStatus;
  owner: string;
  targetDate: string;
  description: string;
  phase: ProjectPhase;
  createdAt: string;
  archived: boolean;

  /** Estado del ciclo de vida del producto en el mercado. */
  lifecycleStatus: LifecycleStatus;

  /** Código SAP asignado al producto (opcional hasta que se registre en SAP). */
  sapCode?: string;

  /** Número de versión: 1, 2, 3… Se muestra como "v1", "v2", etc. */
  version: number;
  /** Id del proyecto del que deriva esta versión (si es una nueva versión). */
  previousVersionId?: string;
  /** Tipo de sustitución cuando es una nueva versión: permanente o temporal. */
  substitutionType?: 'Permanente' | 'Temporal';
  /** Fecha de fin de la sustitución temporal (ISO string). Sólo para substitutionType 'Temporal'. */
  temporalEndDate?: string;
  /** El producto ha sido descatalogado (retirado del mercado). */
  discontinued?: boolean;

  // Campos extendidos (briefing inicial estilo Helios)
  productLine?: string;
  format?: string;
  markets?: string[];
  labelLanguages?: string[];
  labelLanguagesFront?: string[];
  labelLanguagesBack?: string[];
  launchDate?: string;
  artDeadline?: string;
  regulatoryContact?: string;
  designLead?: string;
  /** Notas de briefing (campo de actualización vía PATCH). */
  briefingNotes?: string;
  briefing?: ProjectBriefing;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  title: string;
  type: string;
  currentVersion: string;
  status: string;
  createdAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionLabel: string;
  createdAt: string;
  author: string;
  reviewStatus: 'Draft' | 'En revisión' | 'Cambios solicitados' | 'Aprobado';
  notes: string;
}

export interface Comment {
  id: string;
  projectId: string;
  documentId?: string;
  versionId?: string;
  author: string;
  role: Role;
  text: string;
  resolved: boolean;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  owner: string;
  role: Role;
  status: 'Pendiente' | 'Completada';
  priority: 'Alta' | 'Media' | 'Baja';
  dueDate: string;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  type:
    | 'PROJECT_CREATED'
    | 'DOCUMENT_UPLOADED'
    | 'NEW_VERSION'
    | 'COMMENT_ADDED'
    | 'REVIEW_APPROVED'
    | 'REVIEW_REJECTED'
    | 'TASK_COMPLETED'
    | 'PHASE_CHANGED'
    | 'SAP_CODE_ASSIGNED';
  text: string;
  actor: string;
  createdAt: string;
  /** Id del PhaseAction relacionado (cuando el evento viene de una acción de fase). */
  phaseActionId?: string;
}

// ─── Arte Final ─────────────────────────────────────────────────────────────

/**
 * Archivo de arte final subido durante la fase "Arte final".
 * Acepta imágenes, PDFs y ZIPs.
 */
export interface ArteFinal {
  id: string;
  projectId: string;
  attachment: ProjectAttachment;
  uploadedBy: string;
  createdAt: string;
}

// ─── Campañas ────────────────────────────────────────────────────────────────

export type CampaignFormat =
  | 'Banner estático/animado'
  | 'Banner expandible/interactivo'
  | 'Rich Media/Video Banners'
  | 'Formatos flotantes/Interstitials'
  | 'Spot Publicitario'
  | 'Branded Content'
  | 'Motion Graphics'
  | 'Videos Corporativos'
  | 'Contenido para Redes Sociales'
  | 'Creatividad'
  | 'Lineal';

export type CampaignStatus =
  | 'Borrador'
  | 'En producción'
  | 'En revisión'
  | 'Aprobada'
  | 'Archivada';

export interface Campaign {
  id: string;
  name: string;
  /** Id del proyecto/producto asociado. */
  projectId: string;
  /** Nombre del producto (desnormalizado para display rápido). */
  productName: string;
  productSku: string;
  formats: CampaignFormat[];
  owner: string;
  designLead?: string;
  launchDate: string;
  artDeadline?: string;
  description: string;
  briefingNotes?: string;
  briefingFileName?: string;
  briefingFileSizeKb?: number;
  status: CampaignStatus;
  createdAt: string;
  archived: boolean;
}

// ─── Activity Replies ────────────────────────────────────────────────────────

export interface ActivityReply {
  id: string;
  /** Id del ActivityEvent al que responde. */
  eventId: string;
  projectId: string;
  text: string;
  author: string;
  role: Role;
  createdAt: string;
}

export interface ProjectAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeKb: number;
  /** Previsualización (URL firmada de storage o blob). */
  dataUrl: string;
  /** Descarga autenticada vía API — no expone Supabase. */
  downloadUrl?: string;
  isImage: boolean;
  /** true si el archivo es un PDF */
  isPdf?: boolean;
  /** Número total de páginas (solo para PDFs) */
  pageCount?: number;
  /** true si el archivo es un ZIP */
  isZip?: boolean;
  createdAt: string;
}

export interface DesignProposal {
  id: string;
  projectId: string;
  name: string;
  version: string;
  comments: string;
  attachments: ProjectAttachment[];
  uploadedBy: string;
  uploadedRole: Role;
  /** Phase during which this proposal was uploaded (used to display in the correct review step). */
  uploadedPhase?: ProjectPhase;
  createdAt: string;
}

export type PhaseActionType = 'comment' | 'approve' | 'reject';

export interface PhaseAction {
  id: string;
  projectId: string;
  phase: ProjectPhase;
  type: PhaseActionType;
  comment?: string;
  actor: string;
  role: Role;
  createdAt: string;
}

/** Archivos de referencia adjuntados durante la revisión de una propuesta. */
export interface ReviewRefAttachment {
  id: string;
  projectId: string;
  proposalId: string;
  attachmentId: string;
  fileName: string;
  mimeType: string;
  fileSizeKb: number;
  dataUrl: string;
  downloadUrl?: string;
  createdAt: string;
  author: string;
}

export interface ImageAnnotation {
  id: string;
  projectId: string;
  proposalId: string;
  attachmentId: string;
  text: string;
  /** Coordenadas relativas al ancho/alto de la imagen (0..1). Si no hay, es un comentario sin pin. */
  position?: { x: number; y: number };
  /**
   * Número de página del PDF donde se realizó la anotación (1-indexed).
   * Para imágenes normales es siempre 1 (o undefined → se trata como 1).
   */
  page?: number;
  phase: ProjectPhase;
  author: string;
  role: Role;
  createdAt: string;
}

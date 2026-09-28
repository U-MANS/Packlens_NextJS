import { create } from 'zustand';
import * as api from '../api';
import {
  mapActivityReply,
  mapAttachment,
  mapComment,
  mapImageAnnotation,
  mapProject,
  mapTask,
  mergeProjectDetail,
} from '../api/mappers';
import type {
  ActivityEvent,
  ActivityReply,
  ArteFinal,
  Campaign,
  Comment,
  DesignProposal,
  ImageAnnotation,
  PhaseAction,
  Project,
  ProjectDocument,
  DocumentVersion,
  ReviewRefAttachment,
  Role,
  Task,
} from '../types';
import { PHASE_TOAST } from '../utils/phase';
import { toast } from '../components/ui/Toast';
import { getErrorMessage } from '../utils/errors';
import { useAuthStore } from './useAuthStore';

function showPhaseToast(phase: string) {
  const t = PHASE_TOAST[phase];
  if (t) toast.show(t.msg, { department: t.dept, type: phase === 'Aprobado' ? 'success' : 'phase' });
}

async function runApi<T>(action: () => Promise<T>, errorMessage: string): Promise<T> {
  try {
    return await action();
  } catch (e) {
    toast.error(getErrorMessage(e, errorMessage));
    throw e;
  }
}

interface AppState {
  projects: Project[];
  documents: ProjectDocument[];
  versions: DocumentVersion[];
  tasks: Task[];
  comments: Comment[];
  activity: ActivityEvent[];
  designProposals: DesignProposal[];
  phaseActions: PhaseAction[];
  imageAnnotations: ImageAnnotation[];
  reviewRefAttachments: ReviewRefAttachment[];
  activityReplies: ActivityReply[];
  campaigns: Campaign[];
  arteFinals: ArteFinal[];

  activeRole: Role;
  isBootstrapped: boolean;
  isLoading: boolean;
  loadError: string | null;

  setActiveRole: (role: Role) => void;
  bootstrap: () => Promise<void>;
  loadProjectDetail: (projectId: string) => Promise<void>;

  addProject: (payload: api.ProjectCreatePayload, briefingFiles?: File[]) => Promise<string>;
  updateProject: (projectId: string, patch: Partial<Project>) => Promise<void>;
  uploadBriefingFiles: (projectId: string, files: File[]) => Promise<void>;
  uploadProjectThumbnail: (projectId: string, file: File) => Promise<void>;
  deleteProjectThumbnail: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  markDiscontinued: (projectId: string) => Promise<void>;

  addDesignProposal: (
    projectId: string,
    name: string,
    version: string,
    comments: string,
    files: File[],
  ) => Promise<void>;

  approveCurrentPhase: (projectId: string, comment?: string) => Promise<void>;
  rejectCurrentPhase: (projectId: string, comment: string) => Promise<void>;
  commentOnPhase: (projectId: string, comment: string) => Promise<void>;

  addImageAnnotation: (
    input: Omit<ImageAnnotation, 'id' | 'createdAt' | 'role' | 'author' | 'phase'>,
  ) => Promise<ImageAnnotation>;
  deleteImageAnnotation: (annotationId: string) => Promise<void>;

  addActivityReply: (eventId: string, projectId: string, text: string) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  resolveComment: (commentId: string) => Promise<void>;
  addTask: (projectId: string, title: string) => Promise<void>;
  addComment: (projectId: string, text: string) => Promise<void>;
  addArteFinal: (projectId: string, file: File) => Promise<void>;
  addReviewRefAttachment: (projectId: string, proposalId: string, file: File) => Promise<void>;
  removeReviewRefAttachment: (id: string) => Promise<void>;
  addCampaign: (campaign: Campaign) => void;
}

function upsertProjectDetail(
  state: AppState,
  projectId: string,
  merged: ReturnType<typeof mergeProjectDetail>,
): Partial<AppState> {
  const exists = state.projects.some((p) => p.id === projectId);
  return {
    projects: exists
      ? state.projects.map((p) => (p.id === projectId ? merged.project : p))
      : [...state.projects, merged.project],
    designProposals: [
      ...state.designProposals.filter((d) => d.projectId !== projectId),
      ...merged.proposals,
    ],
    arteFinals: [
      ...state.arteFinals.filter((a) => a.projectId !== projectId),
      ...merged.arteFinals,
    ],
    phaseActions: [
      ...state.phaseActions.filter((a) => a.projectId !== projectId),
      ...merged.phaseActions,
    ],
    tasks: [...state.tasks.filter((t) => t.projectId !== projectId), ...merged.tasks],
    comments: [...state.comments.filter((c) => c.projectId !== projectId), ...merged.comments],
    activity: [
      ...state.activity.filter((a) => a.projectId !== projectId),
      ...merged.activity,
    ],
    imageAnnotations: [
      ...state.imageAnnotations.filter((a) => a.projectId !== projectId),
      ...merged.annotations,
    ],
    activityReplies: [
      ...state.activityReplies.filter((r) => r.projectId !== projectId),
      ...merged.replies,
    ],
  };
}

export const useAppStore = create<AppState>()((set, get) => ({
  projects: [],
  documents: [],
  versions: [],
  tasks: [],
  comments: [],
  activity: [],
  designProposals: [],
  phaseActions: [],
  imageAnnotations: [],
  reviewRefAttachments: [],
  activityReplies: [],
  campaigns: [],
  arteFinals: [],

  activeRole: 'Marketing',
  isBootstrapped: false,
  isLoading: false,
  loadError: null,

  setActiveRole: (role) => set({ activeRole: role }),

  bootstrap: async () => {
    set({ isLoading: true, loadError: null });
    try {
      const user = useAuthStore.getState().user;
      const projectsRaw = await api.listProjects({ archived: 'false' });
      const projects = projectsRaw.map(mapProject);
      set({
        projects,
        activeRole: user?.role ?? 'Marketing',
        isBootstrapped: true,
        isLoading: false,
      });
    } catch (e) {
      const message = getErrorMessage(e, 'Error cargando datos');
      toast.error(message);
      set({ loadError: message, isLoading: false });
    }
  },

  loadProjectDetail: async (projectId) => {
    try {
      const detail = await api.getProject(projectId);
      const merged = mergeProjectDetail(detail);
      set((s) => upsertProjectDetail(s, projectId, merged));
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error cargando proyecto'));
    }
  },

  addProject: async (payload, briefingFiles = []) => {
    const created = await api.createProject(payload);
    try {
      if (briefingFiles.length > 0) {
        await api.uploadBriefingFiles(created.id, briefingFiles);
      }
      const project = mapProject(created);
      set((s) => ({ projects: [...s.projects, project] }));
      toast.show('¡Proyecto creado! Equipo de Diseño notificado.', {
        department: 'Equipo de Diseño',
        type: 'phase',
      });
      return created.id;
    } catch (e) {
      try {
        await api.archiveProject(created.id);
      } catch {
        /* el proyecto huérfano queda archivado en un reintento manual */
      }
      throw e;
    }
  },

  updateProject: async (projectId, patch) =>
    runApi(async () => {
      const apiPatch: Record<string, unknown> = {};
      if (patch.sapCode !== undefined) apiPatch.sap_code = patch.sapCode;
      if (patch.lifecycleStatus !== undefined) apiPatch.lifecycle_status = patch.lifecycleStatus;
      if (patch.name !== undefined) apiPatch.name = patch.name;
      if (patch.description !== undefined) apiPatch.description = patch.description;
      if (patch.launchDate !== undefined) apiPatch.launch_date = patch.launchDate || null;
      if (patch.artDeadline !== undefined) apiPatch.art_deadline = patch.artDeadline || null;
      if (patch.designLead !== undefined) apiPatch.design_lead = patch.designLead || null;
      if (patch.regulatoryContact !== undefined) apiPatch.regulatory_contact = patch.regulatoryContact || null;
      if (patch.briefingNotes !== undefined) apiPatch.briefing_notes = patch.briefingNotes;
      const updated = await api.updateProjectApi(projectId, apiPatch);
      const mapped = mapProject(updated);
      set((s) => ({
        projects: s.projects.map((p) => (p.id === projectId ? { ...p, ...mapped } : p)),
      }));
      if (patch.sapCode !== undefined) {
        await get().loadProjectDetail(projectId);
      }
      if (Object.keys(apiPatch).length > 0) {
        toast.success(
          patch.sapCode !== undefined ? 'Código SAP actualizado' : 'Proyecto actualizado',
        );
      }
    }, 'Error actualizando proyecto'),

  uploadBriefingFiles: async (projectId, files) =>
    runApi(async () => {
      await api.uploadBriefingFiles(projectId, files);
      await get().loadProjectDetail(projectId);
      toast.success('Archivos de briefing añadidos');
    }, 'Error subiendo archivos de briefing'),

  uploadProjectThumbnail: async (projectId, file) =>
    runApi(async () => {
      const updated = await api.uploadProjectThumbnail(projectId, file);
      const mapped = mapProject(updated);
      set((s) => ({
        projects: s.projects.map((p) => (p.id === projectId ? { ...p, ...mapped } : p)),
      }));
      toast.success('Thumbnail actualizado');
    }, 'Error subiendo thumbnail'),

  deleteProjectThumbnail: async (projectId) =>
    runApi(async () => {
      const updated = await api.deleteProjectThumbnail(projectId);
      const mapped = mapProject(updated);
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === projectId ? { ...p, ...mapped, thumbnail: undefined } : p,
        ),
      }));
      toast.success('Thumbnail eliminado');
    }, 'Error eliminando thumbnail'),

  deleteProject: async (projectId) =>
    runApi(async () => {
      const updated = await api.archiveProject(projectId);
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === projectId ? mapProject(updated) : p,
        ),
      }));
      toast.success('Proyecto archivado');
    }, 'Error al archivar el proyecto'),

  markDiscontinued: async (projectId) =>
    runApi(async () => {
      const updated = await api.discontinueProject(projectId);
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === projectId ? mapProject(updated) : p,
        ),
      }));
      toast.success('Producto marcado como descatalogado');
    }, 'Error al descatalogar el producto'),

  addDesignProposal: async (projectId, name, version, comments, files) =>
    runApi(async () => {
      await api.createProposal(projectId, name, version, comments, files);
      await get().loadProjectDetail(projectId);
      const project = get().projects.find((p) => p.id === projectId);
      if (project) showPhaseToast(project.phase);
    }, 'Error al subir la propuesta'),

  approveCurrentPhase: async (projectId, comment) =>
    runApi(async () => {
      const updated = await api.approvePhase(projectId, comment);
      await get().loadProjectDetail(projectId);
      showPhaseToast(updated.phase);
    }, 'Error al aprobar la fase'),

  rejectCurrentPhase: async (projectId, comment) =>
    runApi(async () => {
      await api.rejectPhase(projectId, comment);
      await get().loadProjectDetail(projectId);
      const project = get().projects.find((p) => p.id === projectId);
      if (project) {
        const t = PHASE_TOAST[project.phase] ?? PHASE_TOAST['Diseño'];
        toast.show(`Arte devuelto a "${project.phase}"`, { department: t.dept, type: 'info' });
      }
    }, 'Error al rechazar la fase'),

  commentOnPhase: async (projectId, comment) =>
    runApi(async () => {
      await api.commentPhase(projectId, comment);
      await get().loadProjectDetail(projectId);
      toast.success('Comentario enviado');
    }, 'Error al enviar el comentario'),

  addImageAnnotation: async (input) =>
    runApi(async () => {
      const created = await api.createAnnotation(input.projectId, {
        proposal_id: input.proposalId,
        attachment_id: input.attachmentId,
        text: input.text,
        position: input.position,
        page: input.page,
      });
      const annotation = mapImageAnnotation(created);
      set((s) => ({ imageAnnotations: [...s.imageAnnotations, annotation] }));
      return annotation;
    }, 'Error al guardar la anotación'),

  deleteImageAnnotation: async (annotationId) =>
    runApi(async () => {
      await api.deleteAnnotation(annotationId);
      set((s) => ({
        imageAnnotations: s.imageAnnotations.filter((a) => a.id !== annotationId),
      }));
    }, 'Error al eliminar la anotación'),

  addActivityReply: async (eventId, projectId, text) =>
    runApi(async () => {
      const reply = await api.createActivityReply(eventId, text);
      const mapped = mapActivityReply(reply);
      set((s) => ({ activityReplies: [...s.activityReplies, mapped] }));
      await get().loadProjectDetail(projectId);
    }, 'Error al enviar la respuesta'),

  toggleTask: async (taskId) =>
    runApi(async () => {
      const task = get().tasks.find((t) => t.id === taskId);
      if (!task) return;
      const next = task.status === 'Pendiente' ? 'Completada' : 'Pendiente';
      const updated = await api.toggleTaskApi(taskId, next);
      const mapped = mapTask(updated);
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === taskId ? mapped : t)),
      }));
    }, 'Error al actualizar la tarea'),

  addTask: async (projectId, title) =>
    runApi(async () => {
      const role = get().activeRole;
      const created = await api.createTask(projectId, {
        title: title.trim(),
        role,
        priority: 'Media',
      });
      const mapped = mapTask(created);
      set((s) => ({ tasks: [...s.tasks, mapped] }));
      toast.success('Tarea creada');
    }, 'Error al crear la tarea'),

  addComment: async (projectId, text) =>
    runApi(async () => {
      const created = await api.createComment(projectId, text.trim());
      const mapped = mapComment(created);
      set((s) => ({ comments: [mapped, ...s.comments] }));
      toast.success('Comentario añadido');
    }, 'Error al crear el comentario'),

  resolveComment: async (commentId) =>
    runApi(async () => {
      const updated = await api.resolveCommentApi(commentId);
      const mapped = mapComment(updated);
      set((s) => ({
        comments: s.comments.map((c) => (c.id === commentId ? mapped : c)),
      }));
    }, 'Error al resolver el comentario'),

  addArteFinal: async (projectId, file) =>
    runApi(async () => {
      await api.uploadArteFinal(projectId, file);
      await get().loadProjectDetail(projectId);
      toast.success('Arte final subido correctamente');
    }, 'Error al subir el arte final'),

  addReviewRefAttachment: async (projectId, proposalId, file) =>
    runApi(async () => {
      const res = await api.uploadReviewRef(projectId, proposalId, file);
      const att = mapAttachment(res.attachment);
      set((s) => ({
        reviewRefAttachments: [
          ...s.reviewRefAttachments,
          {
            id: res.id,
            projectId,
            proposalId,
            attachmentId: att.id,
            fileName: att.fileName,
            mimeType: att.mimeType,
            fileSizeKb: att.fileSizeKb,
            dataUrl: att.dataUrl,
            downloadUrl: att.downloadUrl,
            createdAt: new Date().toISOString(),
            author: useAuthStore.getState().user?.name ?? '',
          },
        ],
      }));
    }, 'Error al adjuntar la referencia'),

  removeReviewRefAttachment: async (id) =>
    runApi(async () => {
      await api.deleteReviewRef(id);
      set((s) => ({
        reviewRefAttachments: s.reviewRefAttachments.filter((r) => r.id !== id),
      }));
    }, 'Error al eliminar la referencia'),

  addCampaign: (campaign) =>
    set((s) => ({ campaigns: [...s.campaigns, campaign] })),
}));

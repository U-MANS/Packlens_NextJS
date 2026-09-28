import type { PhaseAction, ProjectPhase, ProjectStatus } from '../types';

export const PHASE_ORDER: ProjectPhase[] = [
  'Diseño',
  'Aprobación Diseño',
  'Creación Desarrollo',
  'Validación diseño',
  'Aprobación Legal',
  'Arte final',
  'Aprobación final',
  'Aprobado',
];

/** Pipeline de Campaña audiovisual (reutiliza nombres internos de fase). */
export const AV_PHASE_ORDER: ProjectPhase[] = [
  'Creación Desarrollo',
  'Aprobación Diseño',
  'Arte final',
  'Aprobación final',
  'Aprobado',
];

export const PHASE_TO_STATUS: Record<ProjectPhase, ProjectStatus> = {
  'Diseño': 'En diseño',
  'Aprobación Diseño': 'En aprobación diseño',
  'Creación Desarrollo': 'En creación desarrollo',
  'Validación diseño': 'En validación diseño',
  'Aprobación Legal': 'En aprobación legal',
  'Arte final': 'En arte final',
  'Aprobación final': 'En aprobación final',
  'Aprobado': 'Aprobado',
};

export function isAudiovisualFlow(flowType?: string | null): boolean {
  return flowType === 'Campaña audiovisual';
}

export function getPhaseOrder(flowType?: string | null): ProjectPhase[] {
  return isAudiovisualFlow(flowType) ? AV_PHASE_ORDER : PHASE_ORDER;
}

export function phaseDisplayName(phase: string, flowType?: string | null): string {
  if (!isAudiovisualFlow(flowType)) return phase;
  const labels: Record<string, string> = {
    'Creación Desarrollo': 'Desarrollo',
    'Aprobación Diseño': 'Aprobación Marketing',
    'Arte final': 'Masters finales',
    'Aprobación final': 'Aprobación final',
    Aprobado: 'Aprobado',
  };
  return labels[phase] ?? phase;
}

export const phaseIndex = (phase: ProjectPhase, flowType?: string | null) =>
  getPhaseOrder(flowType).indexOf(phase);

export const nextPhase = (phase: ProjectPhase, flowType?: string | null): ProjectPhase => {
  const order = getPhaseOrder(flowType);
  const idx = order.indexOf(phase);
  if (idx < 0 || idx >= order.length - 1) return phase;
  return order[idx + 1];
};

/** Returns the phase immediately before the given one, or the same phase if already first. */
export const prevPhase = (phase: ProjectPhase, flowType?: string | null): ProjectPhase => {
  const order = getPhaseOrder(flowType);
  const idx = order.indexOf(phase);
  if (idx <= 0) return phase;
  return order[idx - 1];
};

/** Fase inmediatamente posterior en el pipeline (origen de un rechazo que devuelve a `phase`). */
export const rejectionSourcePhase = (
  phase: ProjectPhase,
  flowType?: string | null,
): ProjectPhase | null => {
  const next = nextPhase(phase, flowType);
  return next === phase ? null : next;
};

/**
 * Último rechazo de la fase siguiente que devolvió el proyecto a `selectedPhase`.
 * Ej.: en Validación diseño → rechazo registrado en Aprobación Legal.
 */
export function getLatestIncomingRejection(
  actions: PhaseAction[],
  selectedPhase: ProjectPhase,
  projectId: string,
  flowType?: string | null,
): PhaseAction | undefined {
  const source = rejectionSourcePhase(selectedPhase, flowType);
  if (!source) return undefined;
  return actions
    .filter(
      (a) =>
        a.projectId === projectId && a.phase === source && a.type === 'reject',
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/**
 * Rechazo pendiente de atender: el proyecto está en `selectedPhase` con cambios
 * solicitados y el último rechazo de la fase siguiente es posterior a la última
 * aprobación en la fase actual.
 */
export function getPendingIncomingRejection(
  actions: PhaseAction[],
  selectedPhase: ProjectPhase,
  projectId: string,
  projectPhase: ProjectPhase,
  projectStatus: ProjectStatus,
  flowType?: string | null,
): PhaseAction | undefined {
  if (projectPhase !== selectedPhase || projectStatus !== 'Cambios solicitados') {
    return undefined;
  }
  const rejection = getLatestIncomingRejection(actions, selectedPhase, projectId, flowType);
  if (!rejection) return undefined;
  const lastApproval = actions
    .filter((a) => a.projectId === projectId && a.phase === selectedPhase && a.type === 'approve')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (lastApproval && lastApproval.createdAt >= rejection.createdAt) {
    return undefined;
  }
  return rejection;
}

/** Fases de revisión posteriores al desarrollo cuyos rechazos interesan a Diseño. */
export const DEVELOPMENT_REVIEW_PHASES: ProjectPhase[] = [
  'Validación diseño',
  'Aprobación Legal',
];

/**
 * Rechazos de Validación diseño y Aprobación Legal desde el último archivo de desarrollo
 * (o desde la aprobación de diseño si aún no hay desarrollo subido).
 */
export function getDevelopmentRejectionChain(
  actions: PhaseAction[],
  projectId: string,
  latestDesarrolloCreatedAt?: string,
): PhaseAction[] {
  const cycleStart =
    latestDesarrolloCreatedAt ??
    actions
      .filter(
        (a) =>
          a.projectId === projectId &&
          a.phase === 'Aprobación Diseño' &&
          a.type === 'approve',
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt;

  if (!cycleStart) return [];

  return actions
    .filter(
      (a) =>
        a.projectId === projectId &&
        a.type === 'reject' &&
        DEVELOPMENT_REVIEW_PHASES.includes(a.phase) &&
        a.createdAt >= cycleStart,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Fases en las que se muestra la vista de revisión (acciones rechazar/aprobar). */
export const isReviewPhase = (phase: ProjectPhase) =>
  phase === 'Aprobación Diseño' ||
  phase === 'Validación diseño' ||
  phase === 'Aprobación Legal' ||
  phase === 'Arte final' ||
  phase === 'Aprobación final';

/** Fases en las que el responsable de Diseño sube propuesta de diseño. */
export const isDesignUploadPhase = (phase: ProjectPhase) =>
  phase === 'Diseño' || phase === 'Aprobación Diseño';

/** Fases en las que el responsable de Diseño sube un archivo (diseño o desarrollo). */
export const isDesarrolloUploadPhase = (phase: ProjectPhase) =>
  phase === 'Creación Desarrollo';

/**
 * ¿La propuesta pertenece al mismo grupo de subida que la fase actual?
 * Diseño y Aprobación Diseño comparten contador; Creación Desarrollo tiene el suyo.
 */
export function isProposalInUploadGroup(
  uploadedPhase: ProjectPhase | undefined,
  currentPhase: ProjectPhase,
): boolean {
  if (isDesarrolloUploadPhase(currentPhase)) {
    return uploadedPhase === 'Creación Desarrollo';
  }
  if (isDesignUploadPhase(currentPhase)) {
    return (
      !uploadedPhase ||
      uploadedPhase === 'Diseño' ||
      uploadedPhase === 'Aprobación Diseño'
    );
  }
  return false;
}

/** Siguiente etiqueta de versión (v1.0, v2.0…) según las versiones ya usadas en el grupo. */
export function suggestNextProposalVersion(existingVersions: string[]): string {
  let max = 0;
  for (const raw of existingVersions) {
    const match = raw.trim().match(/^v?(\d+)/i);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `v${max + 1}.0`;
}

/** ¿Puede este rol aprobar/rechazar la fase indicada? (espejo de backend permissions.py) */
export function canApprovePhase(role: string, phase: ProjectPhase): boolean {
  if (role === 'Admin') return true;
  if (
    role === 'Marketing' &&
    (phase === 'Aprobación Diseño' ||
      phase === 'Validación diseño' ||
      phase === 'Aprobación final')
  ) {
    return true;
  }
  if (phase === 'Aprobación Legal' && role === 'I+D') return true;
  if (phase === 'Arte final' && role === 'Diseño') return true;
  return false;
}

/**
 * Fases en las que el rol tiene trabajo pendiente (subir, revisar o enviar).
 * Usado en dashboard / listado «pendientes míos».
 */
export function isPhaseOwnedByRole(role: string, phase: ProjectPhase): boolean {
  if (role === 'Admin') {
    return phase !== 'Aprobado';
  }
  if (role === 'Diseño') {
    return (
      phase === 'Diseño' ||
      phase === 'Creación Desarrollo' ||
      phase === 'Arte final'
    );
  }
  if (role === 'Marketing') {
    return (
      phase === 'Aprobación Diseño' ||
      phase === 'Validación diseño' ||
      phase === 'Aprobación final'
    );
  }
  if (role === 'I+D') {
    return phase === 'Aprobación Legal';
  }
  return false;
}

export function phasesOwnedByRole(role: string, flowType?: string | null): ProjectPhase[] {
  return getPhaseOrder(flowType).filter((phase) => isPhaseOwnedByRole(role, phase));
}

/** Diseño (y Admin) gestionan subida y envío del arte final / masters. */
export const canManageArteFinal = (role: string, phase: ProjectPhase) =>
  (role === 'Diseño' || role === 'Admin') && phase === 'Arte final';

/** Fases en las que Diseño puede gestionar el briefing creativo. */
export const canManageBriefing = (role: string, phase: ProjectPhase, flowType?: string | null) => {
  if (!(role === 'Diseño' || role === 'Admin' || role === 'Marketing')) return false;
  if (isAudiovisualFlow(flowType)) {
    return phase === 'Creación Desarrollo' || phase === 'Aprobación Diseño';
  }
  return isDesignUploadPhase(phase);
};

/** El proyecto ya superó la aprobación de diseño (no se puede subir desde el paso Diseño). */
export const hasPassedDesignApproval = (phase: ProjectPhase, flowType?: string | null) => {
  if (isAudiovisualFlow(flowType)) {
    return phaseIndex(phase, flowType) > phaseIndex('Aprobación Diseño', flowType);
  }
  return phaseIndex(phase) > phaseIndex('Aprobación Diseño');
};

/** Mensaje de notificación departamental por fase destino. */
export const PHASE_TOAST: Record<string, { msg: string; dept: string }> = {
  'Diseño': {
    msg: 'Arte devuelto a Diseño',
    dept: 'Equipo de Diseño — se han solicitado cambios',
  },
  'Aprobación Diseño': {
    msg: 'Propuesta enviada a Aprobación de Diseño',
    dept: 'Equipo de Marketing',
  },
  'Creación Desarrollo': {
    msg: 'Diseño aprobado — iniciar Creación de Desarrollo',
    dept: 'Equipo de Diseño',
  },
  'Validación diseño': {
    msg: 'Archivo de desarrollo enviado a Validación de Diseño',
    dept: 'Equipo de Marketing',
  },
  'Aprobación Legal': {
    msg: 'Validación de diseño aprobada — enviado a Aprobación Legal',
    dept: 'Departamento Legal (I+D)',
  },
  'Arte final': {
    msg: 'Revisión legal aprobada — subir Arte Final',
    dept: 'Equipo de Diseño',
  },
  'Aprobación final': {
    msg: '¡Arte Final enviado a Aprobación Final!',
    dept: 'Todos los departamentos',
  },
  'Aprobado': {
    msg: '🎉 ¡Proyecto aprobado y cerrado!',
    dept: 'Todos los departamentos',
  },
};

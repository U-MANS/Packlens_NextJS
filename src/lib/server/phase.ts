/**
 * Fases y transiciones — con soporte de flujos (Nacional vs Campaña audiovisual).
 */

export const PHASE_ORDER = [
  'Diseño',
  'Aprobación Diseño',
  'Creación Desarrollo',
  'Validación diseño',
  'Aprobación Legal',
  'Arte final',
  'Aprobación final',
  'Aprobado',
] as const;

/** Pipeline reducido para campañas audiovisuales. */
export const AV_PHASE_ORDER = [
  'Creación Desarrollo',
  'Aprobación Diseño',
  'Arte final',
  'Aprobación final',
  'Aprobado',
] as const;

export type ProjectPhase = (typeof PHASE_ORDER)[number];

export const PHASE_TO_STATUS: Record<string, string> = {
  Diseño: 'En diseño',
  'Aprobación Diseño': 'En aprobación diseño',
  'Creación Desarrollo': 'En creación desarrollo',
  'Validación diseño': 'En validación diseño',
  'Aprobación Legal': 'En aprobación legal',
  'Arte final': 'En arte final',
  'Aprobación final': 'En aprobación final',
  Aprobado: 'Aprobado',
};

export const REVIEW_PHASES = new Set([
  'Aprobación Diseño',
  'Validación diseño',
  'Aprobación Legal',
  'Arte final',
  'Aprobación final',
]);

export const DESIGN_UPLOAD_PHASES = new Set(['Diseño', 'Aprobación Diseño']);

export function isAudiovisualFlow(flowType?: string | null): boolean {
  return flowType === 'Campaña audiovisual';
}

export function getPhaseOrder(flowType?: string | null): readonly string[] {
  return isAudiovisualFlow(flowType) ? AV_PHASE_ORDER : PHASE_ORDER;
}

/** Etiqueta de UI según el flujo. */
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

export function phaseIndex(phase: string, flowType?: string | null): number {
  return getPhaseOrder(flowType).indexOf(phase);
}

export function nextPhase(phase: string, flowType?: string | null): string {
  const order = getPhaseOrder(flowType);
  const idx = order.indexOf(phase);
  if (idx < 0 || idx >= order.length - 1) return phase;
  return order[idx + 1];
}

export function prevPhase(phase: string, flowType?: string | null): string {
  const order = getPhaseOrder(flowType);
  const idx = order.indexOf(phase);
  if (idx <= 0) return phase;
  return order[idx - 1];
}

export function isReviewPhase(phase: string): boolean {
  return REVIEW_PHASES.has(phase);
}

export function isDesignUploadPhase(phase: string): boolean {
  return DESIGN_UPLOAD_PHASES.has(phase);
}

/** Fase inicial al crear un proyecto según el flujo. */
export function initialPhaseForFlow(flowType?: string | null): string {
  return isAudiovisualFlow(flowType) ? 'Creación Desarrollo' : 'Diseño';
}

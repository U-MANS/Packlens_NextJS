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

export function phaseIndex(phase: string): number {
  return PHASE_ORDER.indexOf(phase as ProjectPhase);
}

export function nextPhase(phase: string): string {
  const idx = phaseIndex(phase);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return phase;
  return PHASE_ORDER[idx + 1];
}

export function prevPhase(phase: string): string {
  const idx = phaseIndex(phase);
  if (idx <= 0) return phase;
  return PHASE_ORDER[idx - 1];
}

export function isReviewPhase(phase: string): boolean {
  return REVIEW_PHASES.has(phase);
}

export function isDesignUploadPhase(phase: string): boolean {
  return DESIGN_UPLOAD_PHASES.has(phase);
}

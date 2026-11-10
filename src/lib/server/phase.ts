/**
 * Fases y transiciones — Helios por defecto; aceptan TenantConfig opcional.
 */

import {
  getFlowPhaseOrder,
  isParallelGatePhase,
  phaseDisplayName as tenantPhaseDisplayName,
} from '@/lib/tenant/config';
import { PACKAGING_HELIOS } from '@/lib/tenant/templates/helios';
import type { TenantConfig } from '@/lib/tenant/types';

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

/** Pipeline reducido para campañas audiovisuales (legado Helios). */
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

function resolveConfig(config?: TenantConfig | null): TenantConfig {
  return config || PACKAGING_HELIOS;
}

export function getPhaseOrder(
  flowType?: string | null,
  config?: TenantConfig | null
): readonly string[] {
  const cfg = resolveConfig(config);
  if (config) return getFlowPhaseOrder(cfg, flowType);
  return isAudiovisualFlow(flowType) ? AV_PHASE_ORDER : PHASE_ORDER;
}

/** Etiqueta de UI según el flujo / tenant. */
export function phaseDisplayName(
  phase: string,
  flowType?: string | null,
  config?: TenantConfig | null
): string {
  if (config) return tenantPhaseDisplayName(config, phase);
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

export function phaseIndex(
  phase: string,
  flowType?: string | null,
  config?: TenantConfig | null
): number {
  return getPhaseOrder(flowType, config).indexOf(phase);
}

export function nextPhase(
  phase: string,
  flowType?: string | null,
  config?: TenantConfig | null
): string {
  const order = getPhaseOrder(flowType, config);
  const idx = order.indexOf(phase);
  if (idx < 0 || idx >= order.length - 1) return phase;
  return order[idx + 1];
}

export function prevPhase(
  phase: string,
  flowType?: string | null,
  config?: TenantConfig | null
): string {
  const order = getPhaseOrder(flowType, config);
  const idx = order.indexOf(phase);
  if (idx <= 0) return phase;
  return order[idx - 1];
}

export function isReviewPhase(phase: string, config?: TenantConfig | null): boolean {
  if (config) {
    const def = config.phases.find((p) => p.label === phase);
    return def?.type === 'review' || phase === 'Arte final';
  }
  return REVIEW_PHASES.has(phase);
}

export function isDesignUploadPhase(phase: string): boolean {
  return DESIGN_UPLOAD_PHASES.has(phase);
}

/** Validación diseño + Aprobación Legal: gate paralelo (solo flujo packaging). */
export const PARALLEL_REVIEW_PHASES = ['Validación diseño', 'Aprobación Legal'] as const;

export function isParallelReviewPhase(phase: string, config?: TenantConfig | null): boolean {
  if (config) return isParallelGatePhase(config, phase);
  return (PARALLEL_REVIEW_PHASES as readonly string[]).includes(phase);
}

/** El proyecto está en el gate paralelo (cualquier ancla del par). */
export function isInParallelGate(
  phase: string,
  flowType?: string | null,
  config?: TenantConfig | null
): boolean {
  if (config) {
    if (config.features?.parallelValidationLegal === false) return false;
    return isParallelGatePhase(config, phase);
  }
  if (isAudiovisualFlow(flowType)) return false;
  return isParallelReviewPhase(phase);
}

/** Tras rechazo de cualquiera de las dos vías. */
export const PARALLEL_REJECT_TARGET = 'Creación Desarrollo';

/** Destino cuando ambas vías están aprobadas. */
export const PARALLEL_ADVANCE_TARGET = 'Arte final';

/** Fase inicial al crear un proyecto según el flujo. */
export function initialPhaseForFlow(
  flowType?: string | null,
  config?: TenantConfig | null
): string {
  const order = getPhaseOrder(flowType, config);
  return order[0] || 'Diseño';
}

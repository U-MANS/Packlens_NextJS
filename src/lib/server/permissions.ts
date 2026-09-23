import type { DbUser } from '@/lib/server/auth';
import { isDesignUploadPhase, isReviewPhase } from '@/lib/server/phase';

export function canManageUsers(user: DbUser): boolean {
  return user.role === 'Admin';
}

export function canApprovePhase(user: DbUser, phase: string): boolean {
  if (user.role === 'Admin') return true;
  if (
    user.role === 'Marketing' &&
    ['Aprobación Diseño', 'Validación diseño', 'Aprobación final'].includes(phase)
  ) {
    return true;
  }
  if (phase === 'Aprobación Legal' && user.role === 'I+D') return true;
  if (phase === 'Arte final' && user.role === 'Diseño') return true;
  return false;
}

export function canUploadProposal(user: DbUser, phase: string): boolean {
  if (user.role === 'Admin') return true;
  if (user.role === 'Diseño') {
    return isDesignUploadPhase(phase) || phase === 'Creación Desarrollo';
  }
  return false;
}

export function canUploadArteFinal(user: DbUser, phase: string): boolean {
  if (user.role === 'Admin') return true;
  return user.role === 'Diseño' && phase === 'Arte final';
}

export function canManageBriefing(user: DbUser, phase: string): boolean {
  if (user.role === 'Admin' || user.role === 'Marketing') return true;
  return user.role === 'Diseño' && isDesignUploadPhase(phase);
}

export function assertReviewPhase(phase: string): string | null {
  if (!isReviewPhase(phase)) {
    return `La fase '${phase}' no permite aprobar/rechazar`;
  }
  return null;
}

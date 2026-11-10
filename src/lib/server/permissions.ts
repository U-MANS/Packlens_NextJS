import type { DbUser } from '@/lib/server/auth';
import { isDesignUploadPhase, isReviewPhase } from '@/lib/server/phase';
import { canRoleApprovePhase } from '@/lib/tenant/config';
import { PACKAGING_HELIOS } from '@/lib/tenant/templates/helios';
import type { TenantConfig } from '@/lib/tenant/types';
import { isOpsAdminRole, isPlatformAdminRole } from '@/types';

/** Roles de usuario gestionables (fallback Helios). */
export const USER_ROLES = [
  'Marketing',
  'Diseño',
  'I+D',
  'Comercial',
  'Admin',
  'Manager',
] as const;
export type UserRoleName = (typeof USER_ROLES)[number];

export function isValidUserRole(role: string): role is UserRoleName {
  return (USER_ROLES as readonly string[]).includes(role);
}

export function tenantRoleIds(config?: TenantConfig | null): string[] {
  if (config?.roles?.length) return config.roles.map((r) => r.id);
  return [...USER_ROLES];
}

export function isValidTenantRole(role: string, config?: TenantConfig | null): boolean {
  return tenantRoleIds(config).includes(role);
}

export function canManageUsers(user: DbUser, config?: TenantConfig | null): boolean {
  const roles = config?.permissions.manageUsersRoles ?? ['Admin', 'Manager'];
  return roles.includes(user.role);
}

/** Solo Admin de plataforma: Config. tenant / settings org. */
export function canManageOrgSettings(user: DbUser, config?: TenantConfig | null): boolean {
  const roles = config?.permissions.manageOrgSettingsRoles ?? ['Admin'];
  return roles.includes(user.role);
}

/**
 * Manager no puede crear/asignar Admin ni modificar un Admin existente.
 * Admin de plataforma sí puede gestionar todos los roles.
 */
export function canAssignRole(
  actor: DbUser,
  targetRole: string,
  options?: { targetCurrentRole?: string }
): boolean {
  if (isPlatformAdminRole(actor.role)) return true;
  if (!isOpsAdminRole(actor.role)) return false;
  if (targetRole === 'Admin') return false;
  if (options?.targetCurrentRole === 'Admin') return false;
  return true;
}

export function canApprovePhase(
  user: DbUser,
  phase: string,
  config?: TenantConfig | null
): boolean {
  const cfg = config || PACKAGING_HELIOS;
  if (canRoleApprovePhase(cfg, user.role, phase)) return true;
  if (phase === 'Arte final' && user.role === 'Diseño') return true;
  if (isOpsAdminRole(user.role)) return true;
  return false;
}

export function canUploadProposal(
  user: DbUser,
  phase: string,
  config?: TenantConfig | null
): boolean {
  const cfg = config || PACKAGING_HELIOS;
  if (isOpsAdminRole(user.role)) return true;
  if (isDesignUploadPhase(phase) && cfg.permissions.uploadDesignRoles.includes(user.role)) {
    return true;
  }
  if (phase === 'Creación Desarrollo' && cfg.permissions.uploadDesarrolloRoles.includes(user.role)) {
    return true;
  }
  return false;
}

export function canUploadArteFinal(
  user: DbUser,
  phase: string,
  config?: TenantConfig | null
): boolean {
  const cfg = config || PACKAGING_HELIOS;
  if (phase !== 'Arte final') return false;
  return cfg.permissions.uploadArteFinalRoles.includes(user.role);
}

export function canManageBriefing(
  user: DbUser,
  phase: string,
  config?: TenantConfig | null
): boolean {
  const cfg = config || PACKAGING_HELIOS;
  if (!cfg.permissions.manageBriefingRoles.includes(user.role)) return false;
  return isDesignUploadPhase(phase) || phase === 'Creación Desarrollo';
}

export function assertReviewPhase(phase: string): string | null {
  if (!isReviewPhase(phase)) {
    return `La fase '${phase}' no permite aprobar/rechazar`;
  }
  return null;
}

/** Configuración multi-tenant: flujos, roles, menú y permisos por organización. */

export type TenantPhaseId =
  | 'diseno'
  | 'aprobacion_diseno'
  | 'creacion_desarrollo'
  | 'validacion_diseno'
  | 'aprobacion_legal'
  | 'arte_final'
  | 'aprobacion_final'
  | 'aprobado';

/** Label interno histórico (compatible con columnas phase actuales). */
export type TenantPhaseLabel =
  | 'Diseño'
  | 'Aprobación Diseño'
  | 'Creación Desarrollo'
  | 'Validación diseño'
  | 'Aprobación Legal'
  | 'Arte final'
  | 'Aprobación final'
  | 'Aprobado';

export type TenantPhaseType = 'upload' | 'review' | 'work' | 'final';

export type TenantNavId =
  | 'dashboard'
  | 'projects'
  | 'library'
  | 'moodboard'
  | 'campaigns'
  | 'hours'
  | 'users'
  | 'agents'
  | 'org-settings';

export interface TenantPhaseDef {
  id: TenantPhaseId;
  /** Valor persistido en projects.phase (español histórico). */
  label: TenantPhaseLabel;
  /** Texto mostrado en UI (personalizable). */
  displayName: string;
  type: TenantPhaseType;
  /** Roles que pueden aprobar/rechazar en fases review. */
  approveRoles?: string[];
  /** Roles con trabajo pendiente en esta fase. */
  ownerRoles?: string[];
  /** Grupo paralelo (mismo id = se revisan a la vez). */
  parallelGroup?: string | null;
}

export interface TenantFlowDef {
  id: string;
  name: string;
  /** Labels de fase en orden para este flujo. */
  phaseOrder: TenantPhaseLabel[];
  displayNames?: Partial<Record<TenantPhaseLabel, string>>;
}

export interface TenantRoleDef {
  id: string;
  label: string;
}

export interface TenantNavItem {
  id: TenantNavId;
  label: string;
  path: string;
  /** Si true, Admin o Manager (ops). */
  adminOnly?: boolean;
  /** Si true, solo Admin de plataforma (Config. tenant). */
  platformOnly?: boolean;
  enabled: boolean;
}

export interface TenantPermissions {
  /** Rol ? fases que puede aprobar. */
  approvePhases: Record<string, TenantPhaseLabel[]>;
  uploadDesignRoles: string[];
  uploadDesarrolloRoles: string[];
  uploadArteFinalRoles: string[];
  manageBriefingRoles: string[];
  manageUsersRoles: string[];
  /** Quién puede editar settings / plantilla del tenant. */
  manageOrgSettingsRoles: string[];
}

export interface TenantConfig {
  templateKey: string;
  name: string;
  phases: TenantPhaseDef[];
  flows: TenantFlowDef[];
  roles: TenantRoleDef[];
  nav: TenantNavItem[];
  permissions: TenantPermissions;
  /** feature flags ligeros */
  features?: {
    parallelValidationLegal?: boolean;
    agents?: boolean;
  };
}

export interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  template_key: string;
  settings: Partial<TenantConfig> | Record<string, unknown>;
  status: string;
}

/** Overrides parciales guardados en organizations.settings */
export type TenantSettingsOverride = Partial<{
  name: string;
  phases: TenantPhaseDef[];
  flows: TenantFlowDef[];
  roles: TenantRoleDef[];
  nav: TenantNavItem[];
  permissions: TenantPermissions;
  features: TenantConfig['features'];
  phaseDisplayNames: Partial<Record<TenantPhaseLabel, string>>;
}>;

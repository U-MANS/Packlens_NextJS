import type {
  NavVisibilityMap,
  TenantConfig,
  TenantNavId,
  TenantPhaseLabel,
  TenantSettingsOverride,
} from './types';
import { CONFIGURABLE_NAV_IDS } from './types';
import { DEFAULT_TEMPLATE_KEY, getTemplate } from './templates';

/** ID fijo histórico de Helios (solo referencia / seeds antiguos). */
export const HELIOS_ORG_ID = 'a0000000-0000-4000-8000-000000000001';
export const HELIOS_ORG_SLUG = 'helios';

/** Org opcional de esta instancia si hay más de una fila en la DB. */
export function defaultOrganizationId(): string | null {
  const v = process.env.DEFAULT_ORGANIZATION_ID?.trim();
  return v || null;
}

export function defaultOrganizationSlug(): string | null {
  const v = process.env.DEFAULT_ORGANIZATION_SLUG?.trim();
  return v || null;
}

export function mergeTenantConfig(
  templateKey: string | null | undefined,
  settings: TenantSettingsOverride | Record<string, unknown> | null | undefined
): TenantConfig {
  const base = getTemplate(templateKey || DEFAULT_TEMPLATE_KEY);
  if (!settings || typeof settings !== 'object') return base;

  const s = settings as TenantSettingsOverride;
  const merged: TenantConfig = {
    ...base,
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : base.name,
    phases: Array.isArray(s.phases) && s.phases.length ? s.phases : base.phases,
    flows: Array.isArray(s.flows) && s.flows.length ? s.flows : base.flows,
    roles: Array.isArray(s.roles) && s.roles.length ? s.roles : base.roles,
    nav: Array.isArray(s.nav) && s.nav.length ? s.nav : base.nav,
    permissions: s.permissions ? { ...base.permissions, ...s.permissions } : base.permissions,
    features: s.features ? { ...base.features, ...s.features } : base.features,
  };

  if (s.phaseDisplayNames && typeof s.phaseDisplayNames === 'object') {
    merged.phases = merged.phases.map((p) => {
      const override = s.phaseDisplayNames?.[p.label];
      return override ? { ...p, displayName: override } : p;
    });
  }

  if (s.navVisibility && typeof s.navVisibility === 'object') {
    merged.nav = applyNavVisibility(merged.nav, s.navVisibility);
  }

  return merged;
}

export function applyNavVisibility(
  nav: TenantConfig['nav'],
  visibility: NavVisibilityMap
): TenantConfig['nav'] {
  return nav.map((item) => {
    if (!(CONFIGURABLE_NAV_IDS as readonly string[]).includes(item.id)) return item;
    if (typeof visibility[item.id] !== 'boolean') return item;
    return { ...item, enabled: visibility[item.id] as boolean };
  });
}

export function resolveNavVisibility(
  config: TenantConfig,
  settings: TenantSettingsOverride | Record<string, unknown> | null | undefined
): NavVisibilityMap {
  const stored =
    settings && typeof settings === 'object'
      ? ((settings as TenantSettingsOverride).navVisibility ?? {})
      : {};
  const result: NavVisibilityMap = {};
  for (const id of CONFIGURABLE_NAV_IDS) {
    const item = config.nav.find((n) => n.id === id);
    if (!item) continue;
    result[id] =
      typeof stored[id] === 'boolean' ? (stored[id] as boolean) : item.enabled;
  }
  return result;
}

export function isConfigurableNavId(id: string): id is TenantNavId {
  return (CONFIGURABLE_NAV_IDS as readonly string[]).includes(id);
}

export function getDefaultPhaseOrder(config: TenantConfig): TenantPhaseLabel[] {
  const flow = config.flows[0];
  if (flow?.phaseOrder?.length) return [...flow.phaseOrder];
  return config.phases.map((p) => p.label);
}

export function getFlowPhaseOrder(
  config: TenantConfig,
  flowName: string | null | undefined
): TenantPhaseLabel[] {
  if (!flowName) return getDefaultPhaseOrder(config);
  const normalized = flowName.trim().toLowerCase();
  const flow =
    config.flows.find((f) => f.name.toLowerCase() === normalized) ||
    config.flows.find((f) => f.id.toLowerCase() === normalized);
  return flow?.phaseOrder?.length ? [...flow.phaseOrder] : getDefaultPhaseOrder(config);
}

export function phaseDisplayName(
  config: TenantConfig,
  phase: string | null | undefined
): string {
  if (!phase) return '—';
  const def = config.phases.find((p) => p.label === phase);
  return def?.displayName || phase;
}

export function isParallelGatePhase(
  config: TenantConfig,
  phase: string | null | undefined
): boolean {
  if (!phase) return false;
  const def = config.phases.find((p) => p.label === phase);
  return Boolean(def?.parallelGroup);
}

export function getParallelGroupPhases(
  config: TenantConfig,
  phase: string | null | undefined
): TenantPhaseLabel[] {
  if (!phase) return [];
  const def = config.phases.find((p) => p.label === phase);
  if (!def?.parallelGroup) return [];
  return config.phases
    .filter((p) => p.parallelGroup === def.parallelGroup)
    .map((p) => p.label);
}

export function canRoleApprovePhase(
  config: TenantConfig,
  role: string | null | undefined,
  phase: string | null | undefined
): boolean {
  if (!role || !phase) return false;
  const list = config.permissions.approvePhases[role] || [];
  return list.includes(phase as TenantPhaseLabel);
}

export function enabledNavItems(config: TenantConfig, role: string | null | undefined) {
  const isAdmin = role === 'Admin';
  return config.nav.filter((item) => {
    if (item.adminExclusive && role !== 'Admin') return false;
    if (item.adminOnly && role !== 'Admin' && role !== 'Manager') return false;
    // Admin ve todas las pestañas de plantilla; el resto respeta enabled.
    if (!isAdmin && !item.enabled) return false;
    return true;
  });
}

/** True si el rol puede abrir esta ruta según la config de nav. */
export function canAccessNavPath(
  config: TenantConfig,
  role: string | null | undefined,
  pathname: string
): boolean {
  const allowed = enabledNavItems(config, role);
  const match = config.nav.find((item) => {
    const path = item.path === '/dashboard' ? '/' : item.path;
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  });
  if (!match) return true;
  return allowed.some((item) => item.id === match.id);
}

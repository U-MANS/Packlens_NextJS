import type {
  TenantConfig,
  TenantPhaseLabel,
  TenantSettingsOverride,
} from './types';
import { DEFAULT_TEMPLATE_KEY, getTemplate } from './templates';

export const HELIOS_ORG_ID = 'a0000000-0000-4000-8000-000000000001';
export const HELIOS_ORG_SLUG = 'helios';

/** Feature flag: si false, org Helios implícita y config = plantilla helios. */
export function isMultiTenantEnabled(): boolean {
  const v = process.env.MULTI_TENANT ?? process.env.NEXT_PUBLIC_MULTI_TENANT;
  if (v == null || v === '') return true;
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
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

  return merged;
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
  if (!phase) return '';
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
  return config.nav.filter((item) => {
    if (!item.enabled) return false;
    if (item.platformOnly && role !== 'Admin') return false;
    if (item.adminOnly && role !== 'Admin' && role !== 'Manager') return false;
    return true;
  });
}

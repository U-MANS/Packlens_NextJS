import {
  canRoleApprovePhase,
  getFlowPhaseOrder,
  isParallelGatePhase,
} from './config';
import { PACKAGING_HELIOS } from './templates/helios';

/** Verificación mínima: plantilla Helios = pipeline y permisos actuales. */
export function verifyHeliosTemplateParity(): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const expectedOrder = [
    'Diseño',
    'Aprobación Diseño',
    'Creación Desarrollo',
    'Validación diseño',
    'Aprobación Legal',
    'Arte final',
    'Aprobación final',
    'Aprobado',
  ];
  const order = getFlowPhaseOrder(PACKAGING_HELIOS, 'Nacional');
  if (JSON.stringify(order) !== JSON.stringify(expectedOrder)) {
    errors.push(`phaseOrder mismatch: ${JSON.stringify(order)}`);
  }
  if (!isParallelGatePhase(PACKAGING_HELIOS, 'Validación diseño')) {
    errors.push('Validación diseño should be parallel');
  }
  if (!isParallelGatePhase(PACKAGING_HELIOS, 'Aprobación Legal')) {
    errors.push('Aprobación Legal should be parallel');
  }
  if (!canRoleApprovePhase(PACKAGING_HELIOS, 'Marketing', 'Validación diseño')) {
    errors.push('Marketing should approve Validación');
  }
  if (!canRoleApprovePhase(PACKAGING_HELIOS, 'I+D', 'Aprobación Legal')) {
    errors.push('I+D should approve Legal');
  }
  if (!PACKAGING_HELIOS.nav.every((n) => n.enabled || n.id === 'org-settings')) {
    // org-settings is enabled for Admin customization; all core nav enabled
  }
  const coreNav = ['dashboard', 'projects', 'library', 'moodboard', 'campaigns', 'hours', 'users', 'agents'];
  for (const id of coreNav) {
    const item = PACKAGING_HELIOS.nav.find((n) => n.id === id);
    if (!item?.enabled) errors.push(`nav ${id} should be enabled`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

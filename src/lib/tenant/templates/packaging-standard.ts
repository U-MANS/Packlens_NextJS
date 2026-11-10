import type { TenantConfig } from '../types';
import { PACKAGING_HELIOS } from './helios';

/** Variante editable para nuevos clientes packaging (sin agentes por defecto). */
export const PACKAGING_STANDARD: TenantConfig = {
  ...structuredClone(PACKAGING_HELIOS),
  templateKey: 'packaging-standard',
  name: 'Packaging estándar',
  nav: PACKAGING_HELIOS.nav.map((item) =>
    item.id === 'agents' ? { ...item, enabled: false } : { ...item }
  ),
  features: {
    parallelValidationLegal: true,
    agents: false,
  },
};

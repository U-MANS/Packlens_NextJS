import type { TenantConfig } from '../types';
import { PACKAGING_HELIOS } from './helios';

/** Flujo más corto orientado a campañas audiovisuales. */
export const AUDIOVISUAL_LITE: TenantConfig = {
  ...structuredClone(PACKAGING_HELIOS),
  templateKey: 'audiovisual-lite',
  name: 'Audiovisual lite',
  flows: [
    {
      id: 'campana_audiovisual',
      name: 'Campaña audiovisual',
      phaseOrder: [
        'Diseño',
        'Aprobación Diseño',
        'Creación Desarrollo',
        'Validación diseño',
        'Arte final',
        'Aprobación final',
        'Aprobado',
      ],
    },
  ],
  phases: PACKAGING_HELIOS.phases
    .filter((p) => p.label !== 'Aprobación Legal')
    .map((p) => ({ ...p, parallelGroup: null })),
  roles: PACKAGING_HELIOS.roles.filter((r) => r.id !== 'I+D'),
  nav: PACKAGING_HELIOS.nav.map((item) => {
    if (item.id === 'agents') return { ...item, enabled: false };
    if (item.id === 'library') return { ...item, enabled: false };
    return { ...item };
  }),
  permissions: {
    ...PACKAGING_HELIOS.permissions,
    approvePhases: {
      Admin: ['Aprobación Diseño', 'Validación diseño', 'Arte final', 'Aprobación final'],
      Manager: ['Aprobación Diseño', 'Validación diseño', 'Arte final', 'Aprobación final'],
      Marketing: ['Aprobación Diseño', 'Validación diseño', 'Aprobación final'],
      Diseño: ['Arte final'],
      Comercial: [],
    },
  },
  features: {
    parallelValidationLegal: false,
    agents: false,
  },
};

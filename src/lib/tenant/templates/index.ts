import type { TenantConfig } from '../types';
import { AUDIOVISUAL_LITE } from './audiovisual-lite';
import { PACKAGING_HELIOS } from './helios';
import { PACKAGING_STANDARD } from './packaging-standard';

export const TEMPLATE_CATALOG: Record<string, TenantConfig> = {
  'packaging-helios': PACKAGING_HELIOS,
  'packaging-standard': PACKAGING_STANDARD,
  'audiovisual-lite': AUDIOVISUAL_LITE,
};

export const DEFAULT_TEMPLATE_KEY = 'packaging-helios';

export function getTemplate(key: string | null | undefined): TenantConfig {
  if (key && TEMPLATE_CATALOG[key]) {
    return structuredClone(TEMPLATE_CATALOG[key]);
  }
  return structuredClone(PACKAGING_HELIOS);
}

export { PACKAGING_HELIOS, PACKAGING_STANDARD, AUDIOVISUAL_LITE };

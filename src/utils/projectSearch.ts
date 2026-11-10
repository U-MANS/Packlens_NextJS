import type { Project } from '../types';

/** Normaliza para búsqueda (minúsculas + sin diacríticos). */
export function normalizeSearchQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Misma lógica para buscador global y filtro de Proyectos. */
export function projectMatchesSearch(project: Project, rawQuery: string): boolean {
  const q = normalizeSearchQuery(rawQuery);
  if (!q) return true;
  const haystack = [
    project.name,
    project.sku,
    project.sapCode,
    project.productLine,
  ]
    .filter(Boolean)
    .map((v) => normalizeSearchQuery(String(v)));
  return haystack.some((field) => field.includes(q));
}

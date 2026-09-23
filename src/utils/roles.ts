import type { Project, Role } from '../types';

/** Vista restringida: Comercial solo consulta productos vigentes en mercado. */
export function isComercialView(role: Role): boolean {
  return role === 'Comercial';
}

export function isProjectVisibleToRole(
  project: Pick<Project, 'lifecycleStatus' | 'archived'>,
  role: Role,
): boolean {
  if (project.archived) return false;
  if (!isComercialView(role)) return true;
  return (project.lifecycleStatus ?? 'Borrador') === 'Vigente';
}

export function filterProjectsForRole<T extends Pick<Project, 'lifecycleStatus' | 'archived'>>(
  projects: T[],
  role: Role,
): T[] {
  return projects.filter((p) => isProjectVisibleToRole(p, role));
}

import { productLines } from '../data/mockSeed';
import type { LifecycleStatus, Project, ProjectPhase } from '../types';

/** SKU raíz sin sufijo de versión (-001, -002…). */
export function skuBase(sku: string): string {
  return sku.replace(/-\d{3}$/, '');
}

export function matchesSkuFamily(sku: string, base: string): boolean {
  if (sku === base) return true;
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}-\\d{3}$`).test(sku);
}

export interface LibraryProductFamily {
  skuBase: string;
  name: string;
  productLine: string;
  format: string;
  versions: Project[];
  latestVersion: Project;
  versionCount: number;
}

export interface LibraryFormatGroup {
  format: string;
  products: LibraryProductFamily[];
}

export interface LibraryLineGroup {
  productLine: string;
  formats: LibraryFormatGroup[];
  productCount: number;
}

const LIFECYCLE_RANK: Record<LifecycleStatus, number> = {
  Vigente: 0,
  Temporal: 1,
  'Pendiente SAP': 2,
  Borrador: 3,
  Obsoleta: 4,
};

function compareLifecycle(a: LifecycleStatus | undefined, b: LifecycleStatus | undefined): number {
  return (LIFECYCLE_RANK[a ?? 'Borrador'] ?? 5) - (LIFECYCLE_RANK[b ?? 'Borrador'] ?? 5);
}

function compareProductLine(a: string, b: string): number {
  const ia = productLines.indexOf(a);
  const ib = productLines.indexOf(b);
  const rankA = ia === -1 ? 999 : ia;
  const rankB = ib === -1 ? 999 : ib;
  if (rankA !== rankB) return rankA - rankB;
  if (a === 'Sin gama') return 1;
  if (b === 'Sin gama') return -1;
  return a.localeCompare(b, 'es');
}

export function groupProjectsIntoFamilies(projects: Project[]): LibraryProductFamily[] {
  const byBase = new Map<string, Project[]>();

  for (const project of projects) {
    const base = skuBase(project.sku);
    const list = byBase.get(base) ?? [];
    list.push(project);
    byBase.set(base, list);
  }

  const families: LibraryProductFamily[] = [];

  for (const [base, versions] of byBase) {
    const sorted = [...versions].sort((a, b) => (a.version ?? 1) - (b.version ?? 1));
    const latest =
      [...versions].sort((a, b) => {
        const vDiff = (b.version ?? 1) - (a.version ?? 1);
        if (vDiff !== 0) return vDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })[0] ?? sorted[0];

    const productLine = latest.productLine?.trim() || 'Sin gama';
    const format = latest.format?.trim() || 'Sin formato';

    families.push({
      skuBase: base,
      name: latest.name,
      productLine,
      format,
      versions: sorted,
      latestVersion: latest,
      versionCount: sorted.length,
    });
  }

  return families;
}

export function buildLibraryTree(projects: Project[]): LibraryLineGroup[] {
  const families = groupProjectsIntoFamilies(projects);
  const lineMap = new Map<string, Map<string, LibraryProductFamily[]>>();

  for (const family of families) {
    const formats = lineMap.get(family.productLine) ?? new Map<string, LibraryProductFamily[]>();
    const list = formats.get(family.format) ?? [];
    list.push(family);
    formats.set(family.format, list);
    lineMap.set(family.productLine, formats);
  }

  const tree: LibraryLineGroup[] = [];

  for (const [productLine, formatMap] of lineMap) {
    const formats: LibraryFormatGroup[] = [];

    for (const [format, products] of formatMap) {
      products.sort((a, b) => a.name.localeCompare(b.name, 'es'));
      formats.push({ format, products });
    }

    formats.sort((a, b) => {
      if (a.format === 'Sin formato') return 1;
      if (b.format === 'Sin formato') return -1;
      return a.format.localeCompare(b.format, 'es');
    });

    const productCount = formats.reduce((sum, f) => sum + f.products.length, 0);
    tree.push({ productLine, formats, productCount });
  }

  tree.sort((a, b) => compareProductLine(a.productLine, b.productLine));
  return tree;
}

export function findProductFamily(projects: Project[], baseSku: string): LibraryProductFamily | undefined {
  const decoded = decodeURIComponent(baseSku);
  return groupProjectsIntoFamilies(projects).find((f) => f.skuBase === decoded);
}

export function filterLibraryTree(
  tree: LibraryLineGroup[],
  query: string,
  lifecycleStatuses?: LifecycleStatus[],
): LibraryLineGroup[] {
  const q = query.trim().toLowerCase();
  const statusSet =
    lifecycleStatuses && lifecycleStatuses.length > 0 ? new Set(lifecycleStatuses) : null;

  const matchesProduct = (p: LibraryProductFamily) => {
    if (statusSet && !statusSet.has(summarizeFamilyLifecycle(p))) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.skuBase.toLowerCase().includes(q) ||
      p.productLine.toLowerCase().includes(q) ||
      p.format.toLowerCase().includes(q) ||
      p.latestVersion.sapCode?.toLowerCase().includes(q)
    );
  };

  if (!q && !statusSet) return tree;

  return tree
    .map((line) => {
      const formats = line.formats
        .map((fmt) => ({
          ...fmt,
          products: fmt.products.filter(matchesProduct),
        }))
        .filter((fmt) => fmt.products.length > 0);

      return { ...line, formats, productCount: formats.reduce((s, f) => s + f.products.length, 0) };
    })
    .filter((line) => line.productCount > 0);
}

export const LIBRARY_LIFECYCLE_STATUSES: LifecycleStatus[] = [
  'Vigente',
  'Temporal',
  'Pendiente SAP',
  'Borrador',
  'Obsoleta',
];

export const PHASE_ORDER: ProjectPhase[] = [
  'Diseño',
  'Aprobación Diseño',
  'Creación Desarrollo',
  'Validación diseño',
  'Aprobación Legal',
  'Arte final',
  'Aprobación final',
  'Aprobado',
];

export function phaseIndex(phase: ProjectPhase | string): number {
  const idx = PHASE_ORDER.indexOf(phase as ProjectPhase);
  return idx === -1 ? 0 : idx;
}

export function summarizeFamilyLifecycle(family: LibraryProductFamily): LifecycleStatus {
  const sorted = [...family.versions].sort((a, b) => compareLifecycle(a.lifecycleStatus, b.lifecycleStatus));
  return sorted[0]?.lifecycleStatus ?? 'Borrador';
}

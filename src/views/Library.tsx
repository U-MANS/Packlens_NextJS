import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  Search,
} from 'lucide-react';

import * as api from '../api';
import { mapProject } from '../api/mappers';
import { Card, CardHeader } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { useAppStore } from '../store/useAppStore';
import type { LifecycleStatus, Project } from '../types';
import {
  buildLibraryTree,
  filterLibraryTree,
  LIBRARY_LIFECYCLE_STATUSES,
  summarizeFamilyLifecycle,
} from '../utils/library';
import { filterProjectsForRole, isComercialView } from '../utils/roles';
import { getErrorMessage } from '../utils/errors';

const LIFECYCLE_STYLES: Record<LifecycleStatus, string> = {
  Borrador: 'bg-slate-100 text-slate-600 border-slate-200',
  'Pendiente SAP': 'bg-amber-50 text-amber-700 border-amber-200',
  Vigente: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Temporal: 'bg-blue-50 text-blue-700 border-blue-200',
  Obsoleta: 'bg-red-50 text-red-600 border-red-200',
};

const LifecycleBadge = ({ status }: { status: LifecycleStatus }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${LIFECYCLE_STYLES[status]}`}
  >
    {status}
  </span>
);

async function fetchAllProjects(): Promise<Project[]> {
  const [active, archived] = await Promise.all([
    api.listProjects({ archived: 'false' }),
    api.listProjects({ archived: 'true' }),
  ]);
  const byId = new Map<string, Project>();
  for (const raw of [...active, ...archived]) {
    byId.set(raw.id, mapProject(raw));
  }
  return [...byId.values()];
}

const Library = () => {
  const navigate = useNavigate();
  const activeRole = useAppStore((s) => s.activeRole);
  const isComercial = isComercialView(activeRole);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleStatus[]>([]);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const all = await fetchAllProjects();
        const scoped = filterProjectsForRole(all, activeRole);
        if (!cancelled) {
          setProjects(scoped);
          const lines = new Set(scoped.map((p) => p.productLine?.trim() || 'Sin gama'));
          setExpandedLines(lines);
        }
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, 'No se pudo cargar la biblioteca'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRole]);

  const tree = useMemo(() => buildLibraryTree(projects), [projects]);
  const filteredTree = useMemo(
    () => filterLibraryTree(tree, search, lifecycleFilter),
    [tree, search, lifecycleFilter],
  );

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      LIBRARY_LIFECYCLE_STATUSES.map((s) => [s, 0]),
    ) as Record<LifecycleStatus, number>;
    for (const line of tree) {
      for (const fmt of line.formats) {
        for (const product of fmt.products) {
          const status = summarizeFamilyLifecycle(product);
          counts[status] = (counts[status] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [tree]);

  const filteredProductCount = useMemo(
    () => filteredTree.reduce((sum, line) => sum + line.productCount, 0),
    [filteredTree],
  );

  const totalProducts = useMemo(
    () => tree.reduce((sum, line) => sum + line.productCount, 0),
    [tree],
  );

  const toggleLine = (line: string) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  };

  const toggleLifecycle = (status: LifecycleStatus) => {
    setLifecycleFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  };

  const hasActiveFilters = search.trim().length > 0 || lifecycleFilter.length > 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-accent mb-1">
            <BookOpen size={20} />
            <span className="text-sm font-semibold uppercase tracking-wide">Biblioteca</span>
          </div>
          <h1 className="text-2xl font-bold text-primary">Productos por gama y formato</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isComercial
              ? 'Catálogo de productos vigentes en mercado.'
              : 'Catálogo centralizado con el historial de versiones de cada referencia.'}
          </p>
        </div>
        {!loading && (
          <div className="text-sm text-slate-500">
            <span className="font-semibold text-primary">{totalProducts}</span> productos ·{' '}
            <span className="font-semibold text-primary">{projects.length}</span> versiones
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU, gama o SAP…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-lg text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
          />
        </div>

        {!isComercial && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-1">
            Estado
          </span>
          <button
            type="button"
            onClick={() => setLifecycleFilter([])}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              lifecycleFilter.length === 0
                ? 'bg-accent/10 text-accent border-accent/30'
                : 'bg-white text-slate-600 border-border hover:bg-slate-50'
            }`}
          >
            Todos
            <span className="text-[10px] opacity-70">{totalProducts}</span>
          </button>
          {LIBRARY_LIFECYCLE_STATUSES.map((status) => {
            const active = lifecycleFilter.includes(status);
            const count = statusCounts[status] ?? 0;
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleLifecycle(status)}
                disabled={count === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  active
                    ? `${LIFECYCLE_STYLES[status]} border-current`
                    : 'bg-white text-slate-600 border-border hover:bg-slate-50'
                }`}
              >
                {status}
                <span className="text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setLifecycleFilter([]);
              }}
              className="text-xs text-slate-500 hover:text-primary ml-1 underline-offset-2 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        )}

        {hasActiveFilters && !loading && (
          <p className="text-xs text-slate-500">
            Mostrando <span className="font-semibold text-primary">{filteredProductCount}</span> de{' '}
            {totalProducts} productos
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin" />
          Cargando biblioteca…
        </div>
      )}

      {error && (
        <Card>
          <CardHeader>
            <p className="text-red-600 text-sm">{error}</p>
          </CardHeader>
        </Card>
      )}

      {!loading && !error && filteredTree.length === 0 && (
        <Card>
          <CardHeader>
            <p className="text-slate-500 text-sm">
              No hay productos que coincidan con los filtros aplicados.
            </p>
          </CardHeader>
        </Card>
      )}

      {!loading &&
        !error &&
        filteredTree.map((line) => {
          const open = expandedLines.has(line.productLine);
          return (
            <section key={line.productLine} className="border border-border rounded-xl bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleLine(line.productLine)}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {open ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                  <div>
                    <h2 className="font-semibold text-primary">{line.productLine}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {line.productCount} producto{line.productCount !== 1 ? 's' : ''} ·{' '}
                      {line.formats.length} formato{line.formats.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </button>

              {open && (
                <div className="divide-y divide-border">
                  {line.formats.map((fmt) => (
                    <div key={`${line.productLine}-${fmt.format}`}>
                      <div className="px-5 py-2.5 bg-white border-b border-slate-100">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {fmt.format}
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-400 border-b border-border">
                              <th className="px-5 py-3 font-medium">Producto</th>
                              <th className="px-5 py-3 font-medium">Estado</th>
                              <th className="px-5 py-3 font-medium">Fase actual</th>
                              <th className="px-5 py-3 font-medium">Versiones</th>
                              <th className="px-5 py-3 font-medium w-28" />
                            </tr>
                          </thead>
                          <tbody>
                            {fmt.products.map((product) => {
                              const lifecycle = summarizeFamilyLifecycle(product);
                              const latest = product.latestVersion;
                              return (
                                <tr
                                  key={product.skuBase}
                                  className="border-b border-border last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                                  onClick={() =>
                                    navigate(`/library/${encodeURIComponent(product.skuBase)}`)
                                  }
                                >
                                  <td className="px-5 py-4">
                                    <p className="font-medium text-primary">{product.name}</p>
                                    <p className="text-xs text-slate-400 font-mono mt-0.5">{product.skuBase}</p>
                                    {latest.sapCode && (
                                      <p className="text-[11px] text-slate-500 mt-0.5">SAP {latest.sapCode}</p>
                                    )}
                                  </td>
                                  <td className="px-5 py-4">
                                    <LifecycleBadge status={lifecycle} />
                                  </td>
                                  <td className="px-5 py-4">
                                    <StatusBadge status={latest.status} />
                                  </td>
                                  <td className="px-5 py-4">
                                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                                      <History size={14} className="text-slate-400" />
                                      {product.versionCount}
                                      {product.versionCount > 1 && (
                                        <span className="text-xs text-slate-400">
                                          (v1–v{product.versionCount})
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <span className="text-xs font-medium text-accent">Ver historial →</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
};

export default Library;

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  GitBranch,
  Loader2,
  Package,
} from 'lucide-react';

import * as api from '../api';
import { mapProject } from '../api/mappers';
import { StatusBadge } from '../components/ui/Badge';
import { useAppStore } from '../store/useAppStore';
import type { LifecycleStatus, Project } from '../types';
import { findProductFamily } from '../utils/library';
import { filterProjectsForRole } from '../utils/roles';
import { getErrorMessage } from '../utils/errors';
import { formatDate } from '../utils/dates';

const LIFECYCLE_STYLES: Record<LifecycleStatus, string> = {
  Borrador: 'bg-slate-100 text-slate-600 border-slate-200',
  'Pendiente SAP': 'bg-amber-50 text-amber-700 border-amber-200',
  Vigente: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Temporal: 'bg-blue-50 text-blue-700 border-blue-200',
  Obsoleta: 'bg-red-50 text-red-600 border-red-200',
};

const LifecycleBadge = ({ status }: { status: LifecycleStatus | undefined }) => {
  const s = status ?? 'Borrador';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${LIFECYCLE_STYLES[s]}`}
    >
      {s}
    </span>
  );
};

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

const LibraryProduct = () => {
  const { skuBase: skuBaseParam } = useParams<{ skuBase: string }>();
  const navigate = useNavigate();
  const loadProjectDetail = useAppStore((s) => s.loadProjectDetail);
  const activeRole = useAppStore((s) => s.activeRole);
  const activity = useAppStore((s) => s.activity);
  const phaseActions = useAppStore((s) => s.phaseActions);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const all = await fetchAllProjects();
        const scoped = filterProjectsForRole(all, activeRole);
        if (!cancelled) setProjects(scoped);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, 'No se pudo cargar el producto'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRole]);

  const family = useMemo(() => {
    if (!skuBaseParam) return undefined;
    return findProductFamily(projects, skuBaseParam);
  }, [projects, skuBaseParam]);

  const versions = family?.versions ?? [];

  useEffect(() => {
    if (!versions.length) return;
    let cancelled = false;
    (async () => {
      setDetailsLoading(true);
      try {
        await Promise.all(versions.map((v) => loadProjectDetail(v.id)));
      } catch {
        /* loadProjectDetail ya muestra toast */
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [versions, loadProjectDetail]);

  const mergedTimeline = useMemo(() => {
    const ids = new Set(versions.map((v) => v.id));
    const events = activity
      .filter((e) => ids.has(e.projectId))
      .map((e) => ({
        id: e.id,
        at: e.createdAt,
        text: e.text,
        type: e.type,
        actor: e.actor,
        projectId: e.projectId,
      }));

    const actions = phaseActions
      .filter((a) => ids.has(a.projectId))
      .map((a) => ({
        id: a.id,
        at: a.createdAt,
        text: `${a.phase}: ${a.type}${a.comment ? ` — ${a.comment}` : ''}`,
        type: 'phase_action',
        actor: a.actor,
        projectId: a.projectId,
      }));

    return [...events, ...actions].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [activity, phaseActions, versions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
        <Loader2 size={20} className="animate-spin" />
        Cargando producto…
      </div>
    );
  }

  if (error || !family) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => navigate('/library')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary"
        >
          <ArrowLeft size={16} />
          Volver a biblioteca
        </button>
        <p className="text-red-600">{error ?? 'Producto no encontrado en la biblioteca.'}</p>
      </div>
    );
  }

  const latest = family.latestVersion;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <button
        type="button"
        onClick={() => navigate('/library')}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft size={16} />
        Biblioteca
      </button>

      <header className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Package size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">{family.name}</h1>
            <p className="text-sm text-slate-500 font-mono mt-0.5">{family.skuBase}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">{family.productLine}</span>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">{family.format}</span>
          {latest.sapCode && (
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-mono text-xs">
              SAP {latest.sapCode}
            </span>
          )}
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
            <GitBranch size={18} className="text-slate-400" />
            Historial de versiones
          </h2>
          <span className="text-xs text-slate-400">
            {family.versionCount} versión{family.versionCount !== 1 ? 'es' : ''}
          </span>
        </div>

        <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-border">
          {[...versions].reverse().map((version) => (
            <article
              key={version.id}
              className="relative bg-white border border-border rounded-xl p-5 shadow-sm hover:border-accent/30 transition-colors"
            >
              <span className="absolute -left-6 top-6 w-[9px] h-[9px] rounded-full bg-accent border-2 border-white shadow" />
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-mono font-bold text-primary">v{version.version ?? 1}</span>
                    <LifecycleBadge status={version.lifecycleStatus} />
                    <StatusBadge status={version.status} />
                    {version.archived && (
                      <span className="text-[10px] font-semibold uppercase text-slate-400">Archivado</span>
                    )}
                    {version.discontinued && (
                      <span className="text-[10px] font-semibold uppercase text-amber-600">Descatalogado</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">{version.description || 'Sin descripción'}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} />
                      Creado {formatDate(version.createdAt)}
                    </span>
                    {version.launchDate && (
                      <span>Lanzamiento {formatDate(version.launchDate)}</span>
                    )}
                    <span className="font-mono">{version.sku}</span>
                  </div>
                  {version.substitutionType && (
                    <p className="text-xs text-blue-600">
                      Sustitución {version.substitutionType.toLowerCase()}
                      {version.temporalEndDate
                        ? ` hasta ${formatDate(version.temporalEndDate)}`
                        : ''}
                    </p>
                  )}
                </div>
                <Link
                  to={`/projects/${version.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline shrink-0"
                >
                  Abrir proyecto
                  <ExternalLink size={14} />
                </Link>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>Fase: <strong className="text-slate-700">{version.phase}</strong></span>
                <span>Responsable: <strong className="text-slate-700">{version.owner}</strong></span>
                {version.markets?.length ? (
                  <span>Mercados: {version.markets.join(', ')}</span>
                ) : (
                  <span>Mercado: {version.market}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Línea de tiempo</h2>
          {detailsLoading && (
            <span className="text-xs text-slate-400 inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              Cargando actividad…
            </span>
          )}
        </div>

        {mergedTimeline.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-border rounded-xl">
            Aún no hay eventos registrados para este producto.
          </p>
        ) : (
          <ul className="space-y-2">
            {mergedTimeline.slice(0, 50).map((item) => {
              const version = versions.find((v) => v.id === item.projectId);
              return (
                <li
                  key={`${item.type}-${item.id}`}
                  className="flex gap-3 text-sm py-3 px-4 bg-white border border-border rounded-lg"
                >
                  <div className="shrink-0 text-xs text-slate-400 w-24 pt-0.5">
                    {formatDate(item.at)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700">{item.text}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.actor && <span>{item.actor} · </span>}
                      v{version?.version ?? '?'} · {version?.phase}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default LibraryProduct;

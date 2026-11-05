import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Film,
  GitBranch,
  Image as ImageIcon,
  Images,
  Loader2,
  Lock,
  Package,
} from 'lucide-react';

import * as api from '../api';
import { mapProject } from '../api/mappers';
import { StatusBadge } from '../components/ui/Badge';
import { PdfViewerModal } from '../components/ui/PdfViewerModal';
import { useAppStore } from '../store/useAppStore';
import type { LifecycleStatus, Project, ProjectAttachment } from '../types';
import { findProductFamily } from '../utils/library';
import { filterProjectsForRole } from '../utils/roles';
import { getErrorMessage } from '../utils/errors';
import { formatDate, formatDateTime } from '../utils/dates';
import { downloadAttachment, formatFileSize } from '../utils/files';
import { canAccessWorkflowFile } from '../utils/fileAccess';

type ProductTab = 'versions' | 'multimedia' | 'timeline';

const LIFECYCLE_STYLES: Record<LifecycleStatus, string> = {
  Borrador: 'bg-slate-100 text-slate-600 border-slate-200',
  'Pendiente SAP': 'bg-amber-50 text-amber-700 border-amber-200',
  Vigente: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Temporal: 'bg-blue-50 text-blue-700 border-blue-200',
  Obsoleta: 'bg-red-50 text-red-600 border-red-200',
  'En proceso de cambio':
    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/35',
  Sustituido:
    'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-500/25 dark:text-slate-300 dark:border-slate-500/40',
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

interface MediaEntry {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeKb: number;
  dataUrl?: string;
  downloadUrl?: string;
  isImage: boolean;
  isPdf?: boolean;
  isZip?: boolean;
  isVideo?: boolean;
  versionId: string;
  versionNumber: number;
  versionSku: string;
  source: string;
  uploadedAt: string;
  uploadedBy: string;
}

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

function mediaIcon(entry: MediaEntry) {
  if (entry.isImage) return <ImageIcon size={18} className="text-accent" />;
  if (entry.isPdf) return <FileText size={18} className="text-red-500" />;
  if (entry.isZip) return <Archive size={18} className="text-amber-600" />;
  if (entry.isVideo) return <Film size={18} className="text-violet-500" />;
  return <FileText size={18} className="text-slate-400" />;
}

const LibraryProduct = () => {
  const { skuBase: skuBaseParam } = useParams<{ skuBase: string }>();
  const navigate = useNavigate();
  const loadProjectDetail = useAppStore((s) => s.loadProjectDetail);
  const activeRole = useAppStore((s) => s.activeRole);
  const activity = useAppStore((s) => s.activity);
  const phaseActions = useAppStore((s) => s.phaseActions);
  const designProposals = useAppStore((s) => s.designProposals);
  const arteFinals = useAppStore((s) => s.arteFinals);
  const storeProjects = useAppStore((s) => s.projects);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProductTab>('versions');
  const [pdfPreview, setPdfPreview] = useState<{ fileName: string; dataUrl: string } | null>(
    null,
  );

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
  const versionIds = useMemo(() => new Set(versions.map((v) => v.id)), [versions]);

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

  const versionById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const v of versions) map.set(v.id, v);
    // Prefer enriched store copy (briefing files, etc.)
    for (const p of storeProjects) {
      if (versionIds.has(p.id)) map.set(p.id, p);
    }
    return map;
  }, [versions, storeProjects, versionIds]);

  const mediaEntries = useMemo(() => {
    const entries: MediaEntry[] = [];

    for (const version of versions) {
      const project = versionById.get(version.id) ?? version;
      const versionNumber = project.version ?? 1;

      const briefFiles = project.briefing?.files ?? [];
      briefFiles.forEach((f, i) => {
        entries.push({
          id: `brief-${project.id}-${i}`,
          fileName: f.name,
          mimeType: f.mimeType,
          fileSizeKb: f.sizeKb,
          dataUrl: f.dataUrl,
          downloadUrl: f.downloadUrl,
          isImage: f.mimeType.startsWith('image/'),
          isPdf: f.mimeType.includes('pdf'),
          versionId: project.id,
          versionNumber,
          versionSku: project.sku,
          source: 'Briefing',
          uploadedAt: project.briefing?.uploadedAt ?? project.createdAt,
          uploadedBy: project.owner,
        });
      });

      if (!briefFiles.length && project.briefing?.fileName) {
        entries.push({
          id: `brief-legacy-${project.id}`,
          fileName: project.briefing.fileName,
          mimeType: project.briefing.mimeType ?? 'application/octet-stream',
          fileSizeKb: project.briefing.fileSizeKb ?? 0,
          dataUrl: project.briefing.dataUrl,
          downloadUrl: project.briefing.downloadUrl,
          isImage: (project.briefing.mimeType ?? '').startsWith('image/'),
          isPdf: (project.briefing.mimeType ?? '').includes('pdf'),
          versionId: project.id,
          versionNumber,
          versionSku: project.sku,
          source: 'Briefing',
          uploadedAt: project.briefing.uploadedAt ?? project.createdAt,
          uploadedBy: project.owner,
        });
      }

      if (project.thumbnail?.dataUrl || project.thumbnail?.downloadUrl) {
        entries.push({
          id: `thumb-${project.id}`,
          fileName: project.thumbnail.fileName || 'Thumbnail',
          mimeType: project.thumbnail.mimeType || 'image/jpeg',
          fileSizeKb: project.thumbnail.fileSizeKb ?? 0,
          dataUrl: project.thumbnail.dataUrl,
          downloadUrl: project.thumbnail.downloadUrl,
          isImage: true,
          versionId: project.id,
          versionNumber,
          versionSku: project.sku,
          source: 'Thumbnail',
          uploadedAt: project.thumbnail.uploadedAt ?? project.createdAt,
          uploadedBy: project.owner,
        });
      }
    }

    for (const proposal of designProposals) {
      if (!versionIds.has(proposal.projectId)) continue;
      const version = versionById.get(proposal.projectId);
      if (!version) continue;
      proposal.attachments.forEach((att) => {
        entries.push({
          id: att.id,
          fileName: att.fileName,
          mimeType: att.mimeType,
          fileSizeKb: att.fileSizeKb,
          dataUrl: att.dataUrl,
          downloadUrl: att.downloadUrl,
          isImage: att.isImage,
          isPdf: att.isPdf,
          isZip: att.isZip,
          isVideo: att.isVideo || att.mimeType.startsWith('video/'),
          versionId: version.id,
          versionNumber: version.version ?? 1,
          versionSku: version.sku,
          source: `${proposal.name} · ${proposal.version}${
            proposal.uploadedPhase ? ` · ${proposal.uploadedPhase}` : ''
          }`,
          uploadedAt: proposal.createdAt,
          uploadedBy: proposal.uploadedBy,
        });
      });
    }

    for (const af of arteFinals) {
      if (!versionIds.has(af.projectId)) continue;
      const version = versionById.get(af.projectId);
      if (!version) continue;
      const att = af.attachment;
      entries.push({
        id: af.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        fileSizeKb: att.fileSizeKb,
        dataUrl: att.dataUrl,
        downloadUrl: att.downloadUrl,
        isImage: att.isImage,
        isPdf: att.isPdf,
        isZip: att.isZip,
        isVideo: att.isVideo || att.mimeType.startsWith('video/'),
        versionId: version.id,
        versionNumber: version.version ?? 1,
        versionSku: version.sku,
        source: 'Arte final',
        uploadedAt: af.createdAt,
        uploadedBy: af.uploadedBy,
      });
    }

    return entries.sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );
  }, [versions, versionById, versionIds, designProposals, arteFinals]);

  const mergedTimeline = useMemo(() => {
    const events = activity
      .filter((e) => versionIds.has(e.projectId))
      .map((e) => ({
        id: e.id,
        at: e.createdAt,
        text: e.text,
        type: e.type,
        actor: e.actor,
        projectId: e.projectId,
      }));

    const actions = phaseActions
      .filter((a) => versionIds.has(a.projectId))
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
  }, [activity, phaseActions, versionIds]);

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
  const tabs: { id: ProductTab; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'versions',
      label: 'Versiones',
      icon: <GitBranch size={14} />,
      count: family.versionCount,
    },
    {
      id: 'multimedia',
      label: 'Multimedia',
      icon: <Images size={14} />,
      count: mediaEntries.length,
    },
    {
      id: 'timeline',
      label: 'Línea de tiempo',
      icon: <Clock size={14} />,
      count: mergedTimeline.length,
    },
  ];

  const openOrDownload = (entry: MediaEntry) => {
    const allowed = canAccessWorkflowFile(activeRole, {
      mimeType: entry.mimeType,
      fileName: entry.fileName,
      isImage: entry.isImage,
      isPdf: entry.isPdf,
    });
    if (!allowed) return;

    if (entry.isPdf && entry.dataUrl) {
      setPdfPreview({ fileName: entry.fileName, dataUrl: entry.dataUrl });
      return;
    }
    void downloadAttachment({
      fileName: entry.fileName,
      dataUrl: entry.dataUrl,
      downloadUrl: entry.downloadUrl,
    } as ProjectAttachment);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
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
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            {family.productLine}
          </span>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            {family.format}
          </span>
          {latest.sapCode && (
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-mono text-xs">
              SAP {latest.sapCode}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-slate-500 hover:text-primary'
            }`}
          >
            {tab.icon}
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? 'bg-accent/10 text-accent'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {detailsLoading && activeTab !== 'versions' && (
        <p className="text-xs text-slate-400 inline-flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          Cargando detalle de versiones…
        </p>
      )}

      {activeTab === 'versions' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">Historial de versiones</h2>
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
                      <span className="text-sm font-mono font-bold text-primary">
                        v{version.version ?? 1}
                      </span>
                      <LifecycleBadge status={version.lifecycleStatus} />
                      <StatusBadge status={version.status} />
                      {version.archived && (
                        <span className="text-[10px] font-semibold uppercase text-slate-400">
                          Archivado
                        </span>
                      )}
                      {version.discontinued && (
                        <span className="text-[10px] font-semibold uppercase text-amber-600">
                          Descatalogado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      {version.description || 'Sin descripción'}
                    </p>
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
                  <span>
                    Fase: <strong className="text-slate-700">{version.phase}</strong>
                  </span>
                  <span>
                    Responsable: <strong className="text-slate-700">{version.owner}</strong>
                  </span>
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
      )}

      {activeTab === 'multimedia' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-primary">Multimedia</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Archivos subidos en todas las versiones del producto
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {mediaEntries.length} archivo{mediaEntries.length !== 1 ? 's' : ''}
            </span>
          </div>

          {mediaEntries.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center border border-dashed border-border rounded-xl">
              {detailsLoading
                ? 'Cargando archivos…'
                : 'Aún no hay archivos asociados a este producto.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {mediaEntries.map((entry) => {
                const allowed = canAccessWorkflowFile(activeRole, {
                  mimeType: entry.mimeType,
                  fileName: entry.fileName,
                  isImage: entry.isImage,
                  isPdf: entry.isPdf,
                });
                return (
                  <li
                    key={entry.id}
                    className={`flex items-center gap-4 px-4 py-3 bg-white border border-border rounded-xl ${
                      allowed ? '' : 'opacity-80'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg border border-border bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                      {allowed && entry.isImage && entry.dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.dataUrl}
                          alt={entry.fileName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        mediaIcon(entry)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">
                        {entry.fileName}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {allowed ? (
                          <>
                            {entry.fileSizeKb > 0 && (
                              <>
                                {formatFileSize(entry.fileSizeKb)}
                                <span className="mx-1.5">·</span>
                              </>
                            )}
                            {entry.source}
                            <span className="mx-1.5">·</span>
                            v{entry.versionNumber}
                          </>
                        ) : (
                          'Solo disponible para Diseño y Marketing'
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {entry.uploadedBy} · {formatDateTime(entry.uploadedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to={`/projects/${entry.versionId}`}
                        className="text-xs font-medium text-slate-500 hover:text-accent"
                        title="Abrir versión"
                      >
                        v{entry.versionNumber}
                      </Link>
                      {allowed ? (
                        <button
                          type="button"
                          onClick={() => openOrDownload(entry)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-medium text-slate-600 hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-colors"
                        >
                          {entry.isPdf ? (
                            <>
                              <FileText size={13} /> Ver
                            </>
                          ) : (
                            <>
                              <Download size={13} /> Descargar
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="p-2 text-slate-400" title="Archivo restringido">
                          <Lock size={14} />
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'timeline' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">Línea de tiempo</h2>
            <span className="text-xs text-slate-400">
              {mergedTimeline.length} evento{mergedTimeline.length !== 1 ? 's' : ''}
            </span>
          </div>

          {mergedTimeline.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center border border-dashed border-border rounded-xl">
              {detailsLoading
                ? 'Cargando actividad…'
                : 'Aún no hay eventos registrados para este producto.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {mergedTimeline.map((item) => {
                const version = versionById.get(item.projectId);
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
                    {version && (
                      <Link
                        to={`/projects/${version.id}`}
                        className="shrink-0 text-xs text-accent hover:underline self-start pt-0.5"
                      >
                        Abrir
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <PdfViewerModal
        open={!!pdfPreview}
        fileName={pdfPreview?.fileName ?? ''}
        dataUrl={pdfPreview?.dataUrl ?? ''}
        onClose={() => setPdfPreview(null)}
      />
    </div>
  );
};

export default LibraryProduct;

import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  ScanText,
  X,
} from 'lucide-react';

import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import { useAppStore } from '../../store/useAppStore';
import { extractPdfText, renderPdfPage } from '../../utils/pdfRenderer';
import type { PdfPageText } from '../../utils/pdfRenderer';
import { formatFileSize, downloadAttachment } from '../../utils/files';
import { formatDate } from '../../utils/dates';
import type { ProjectPhase } from '../../types';

// ─── Phase colours ───────────────────────────────────────────────────────────

const PHASE_STYLE: Record<
  string,
  { dot: string; badge: string; icon: React.ReactNode }
> = {
  'Proyecto': {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <FolderOpen size={13} />,
  },
  'Diseño': {
    dot: 'bg-purple-500',
    badge: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: <ImageIcon size={13} />,
  },
  'Creación Desarrollo': {
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <FileText size={13} />,
  },
  'Validación diseño': {
    dot: 'bg-orange-400',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: <CheckCircle2 size={13} />,
  },
  'Aprobación Diseño': {
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: <CheckCircle2 size={13} />,
  },
  'Aprobación Legal': {
    dot: 'bg-red-400',
    badge: 'bg-red-100 text-red-700 border-red-200',
    icon: <CheckCircle2 size={13} />,
  },
  'Arte final': {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <Archive size={13} />,
  },
    'Aprobación final': {
    dot: 'bg-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: <CheckCircle2 size={13} />,
  },
  'Aprobado': {
    dot: 'bg-emerald-700',
    badge: 'bg-emerald-200 text-emerald-900 border-emerald-400',
    icon: <CheckCircle2 size={13} />,
  },
};

const phaseStyle = (phase: string) =>
  PHASE_STYLE[phase] ?? {
    dot: 'bg-slate-300',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <FileText size={13} />,
  };

// ─── Document entry ───────────────────────────────────────────────────────────

interface DocEntry {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeKb: number;
  dataUrl: string;
  downloadUrl?: string;
  isImage: boolean;
  isPdf?: boolean;
  isZip?: boolean;
  phase: string;
  uploadedAt: string;
  uploadedBy: string;
  proposalName?: string;
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

const Thumbnail: React.FC<{ entry: DocEntry }> = ({ entry }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entry.isPdf) return;
    let cancelled = false;
    setLoading(true);
    renderPdfPage(entry.dataUrl, 1, 1)
      .then((url) => { if (!cancelled) { setThumbUrl(url); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entry.dataUrl, entry.isPdf]);

  if (entry.isImage) {
    return (
      <div className="w-16 h-16 rounded-lg border border-border overflow-hidden shrink-0 bg-slate-50">
        <img src={entry.dataUrl} alt={entry.fileName} className="w-full h-full object-cover" />
      </div>
    );
  }

  if (entry.isPdf) {
    return (
      <div className="w-16 h-16 rounded-lg border border-border overflow-hidden shrink-0 bg-slate-50 relative flex items-center justify-center">
        {loading && (
          <div className="w-5 h-5 border-2 border-slate-300 border-t-accent rounded-full animate-spin" />
        )}
        {thumbUrl && !loading && (
          <img src={thumbUrl} alt={entry.fileName} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {!loading && !thumbUrl && <FileText size={22} className="text-red-400" />}
        <span className="absolute bottom-0.5 right-0.5 bg-red-600 text-white text-[8px] font-bold px-1 rounded">
          PDF
        </span>
      </div>
    );
  }

  if (entry.isZip) {
    return (
      <div className="w-16 h-16 rounded-lg border border-border shrink-0 bg-yellow-50 flex flex-col items-center justify-center gap-0.5">
        <Archive size={22} className="text-yellow-600" />
        <span className="text-[9px] font-bold text-yellow-700">ZIP</span>
      </div>
    );
  }

  return (
    <div className="w-16 h-16 rounded-lg border border-border shrink-0 bg-slate-50 flex items-center justify-center">
      <FileText size={22} className="text-slate-400" />
    </div>
  );
};

// ─── PDF text analysis panel ──────────────────────────────────────────────────

const TextAnalysisPanel: React.FC<{
  fileName: string;
  pages: PdfPageText[];
  onClose: () => void;
}> = ({ fileName, pages, onClose }) => {
  const totalLines = pages.reduce((s, p) => s + p.lines.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ScanText size={16} className="text-accent shrink-0" />
              <h2 className="text-sm font-semibold text-primary">Análisis de texto</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{fileName}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {pages.length} página{pages.length !== 1 ? 's' : ''} · {totalLines} líneas detectadas
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {pages.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <FileText size={32} className="text-slate-300 mx-auto" />
              <p className="text-sm text-slate-500">No se encontró texto estructurado en este PDF.</p>
              <p className="text-xs text-slate-400">
                Es posible que los textos estén convertidos a contornos (outlines).
              </p>
            </div>
          ) : (
            pages.map((pg) => (
              <div key={pg.page}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Página {pg.page}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-slate-400">{pg.lines.length} líneas</span>
                </div>
                <div className="space-y-1">
                  {pg.lines.map((line, i) => (
                    <div
                      key={i}
                      className="group flex items-baseline gap-2 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                    >
                      {/* Font-size hint */}
                      <span
                        className="shrink-0 text-[10px] font-mono text-slate-300 group-hover:text-slate-400 w-6 text-right"
                        title={`Tamaño aprox. ${line.fontSize}pt`}
                      >
                        {line.fontSize}
                      </span>
                      <p
                        className="text-sm text-primary leading-snug break-words"
                        style={{ fontSize: `${Math.min(Math.max(line.fontSize * 0.6, 10), 16)}px` }}
                      >
                        {line.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: copy all */}
        {totalLines > 0 && (
          <div className="shrink-0 px-5 py-3 border-t border-border bg-slate-50">
            <button
              type="button"
              onClick={() => {
                const text = pages
                  .map((pg) => `--- Página ${pg.page} ---\n${pg.lines.map((l) => l.text).join('\n')}`)
                  .join('\n\n');
                navigator.clipboard.writeText(text);
              }}
              className="w-full text-xs font-medium text-slate-600 hover:text-accent transition-colors py-1"
            >
              Copiar todo el texto al portapapeles
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Phase group ─────────────────────────────────────────────────────────────

// ─── Per-entry PDF analyse button ─────────────────────────────────────────────

const AnalyseButton: React.FC<{ entry: DocEntry }> = ({ entry }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [pages, setPages] = useState<PdfPageText[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleAnalyse = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'loading') return;
    if (status === 'done') { setPanelOpen(true); return; }
    setStatus('loading');
    try {
      const result = await extractPdfText(entry.dataUrl);
      setPages(result);
      setStatus('done');
      setPanelOpen(true);
    } catch {
      setStatus('idle');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleAnalyse}
        title="Analizar textos del PDF"
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border text-slate-500 hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-colors"
      >
        {status === 'loading' ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <ScanText size={13} />
        )}
        <span className="hidden sm:inline">
          {status === 'loading' ? 'Analizando…' : status === 'done' ? 'Ver textos' : 'Analizar textos'}
        </span>
      </button>

      {panelOpen && (
        <TextAnalysisPanel
          fileName={entry.fileName}
          pages={pages}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </>
  );
};

// ─── Phase group ─────────────────────────────────────────────────────────────

const PhaseGroup: React.FC<{
  phase: string;
  entries: DocEntry[];
  onPreviewPdf?: (entry: DocEntry) => void;
}> = ({ phase, entries, onPreviewPdf }) => {
  const [expanded, setExpanded] = useState(true);
  const style = phaseStyle(phase);

  const handleDownloadAll = () => {
    entries.forEach((e) => {
      void downloadAttachment(e);
    });
  };

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
          <span className="text-sm font-semibold text-primary">{phase}</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${style.badge}`}>
            {style.icon} {entries.length} archivo{entries.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDownloadAll(); }}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-accent px-2.5 py-1.5 rounded-md border border-border hover:border-accent/40 hover:bg-accent/5 transition-colors"
          >
            <Download size={12} /> Descargar todos
          </button>
          <ChevronRight
            size={16}
            className={`text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </button>

      {/* File grid */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
              <Thumbnail entry={entry} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">{entry.fileName}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatFileSize(entry.fileSizeKb)}
                  {entry.proposalName && (
                    <span className="ml-1.5 text-slate-400">· {entry.proposalName}</span>
                  )}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {entry.uploadedBy} · {formatDate(entry.uploadedAt)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {entry.isPdf && onPreviewPdf && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreviewPdf(entry);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border text-slate-600 hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-colors"
                    title="Ver PDF"
                  >
                    <Eye size={13} /> Ver
                  </button>
                )}
                {entry.isPdf && <AnalyseButton entry={entry} />}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void downloadAttachment(entry);
                  }}
                  className="p-2 text-slate-400 hover:text-accent hover:bg-accent/5 rounded-md transition-colors"
                  title="Descargar"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const TabDocumentos = ({ projectId }: { projectId: string }) => {
  const { projects, designProposals, arteFinals, reviewRefAttachments } = useAppStore();
  const project = projects.find((p) => p.id === projectId);
  const [pdfPreview, setPdfPreview] = useState<DocEntry | null>(null);

  const allEntries = useMemo<DocEntry[]>(() => {
    const entries: DocEntry[] = [];

    // 1 — Briefing files (phase: "Proyecto")
    const briefFiles = project?.briefing?.files ?? [];
    briefFiles.forEach((f, i) => {
      entries.push({
        id: `brief-${i}`,
        fileName: f.name,
        mimeType: f.mimeType,
        fileSizeKb: f.sizeKb,
        dataUrl: f.dataUrl,
        downloadUrl: f.downloadUrl,
        isImage: f.mimeType.startsWith('image/'),
        isPdf: f.mimeType === 'application/pdf',
        phase: 'Proyecto',
        uploadedAt: project?.briefing?.uploadedAt ?? project?.createdAt ?? '',
        uploadedBy: project?.owner ?? '—',
        proposalName: 'Briefing creativo',
      });
    });
    // Legacy single briefing file
    if (!briefFiles.length && project?.briefing?.fileName && project.briefing.dataUrl) {
      entries.push({
        id: 'brief-legacy',
        fileName: project.briefing.fileName,
        mimeType: project.briefing.mimeType ?? 'application/octet-stream',
        fileSizeKb: project.briefing.fileSizeKb ?? 0,
        dataUrl: project.briefing.dataUrl,
        downloadUrl: project.briefing.downloadUrl,
        isImage: (project.briefing.mimeType ?? '').startsWith('image/'),
        isPdf: project.briefing.mimeType === 'application/pdf',
        phase: 'Proyecto',
        uploadedAt: project.briefing.uploadedAt ?? project.createdAt ?? '',
        uploadedBy: project.owner ?? '—',
        proposalName: 'Briefing creativo',
      });
    }

    // 2 — Design proposals (Diseño and Creación Desarrollo)
    const proposals = designProposals
      .filter((dp) => dp.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    proposals.forEach((dp) => {
      const phase: string = dp.uploadedPhase ?? 'Diseño';
      dp.attachments.forEach((att) => {
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
          phase,
          uploadedAt: dp.createdAt,
          uploadedBy: dp.uploadedBy,
          proposalName: `${dp.name} · ${dp.version}`,
        });
      });
    });

    // 3 — Review reference attachments (Aprobación Diseño / Aprobación Legal)
    const refAtts = reviewRefAttachments.filter((r) => r.projectId === projectId);
    refAtts.forEach((r) => {
      // Determine which phase: find the proposal they're linked to
      const parentProposal = proposals.find((dp) =>
        dp.attachments.some((a) => a.id === r.attachmentId),
      );
      const phase: ProjectPhase =
        parentProposal?.uploadedPhase === 'Creación Desarrollo'
          ? 'Validación diseño'
          : 'Aprobación Diseño';

      entries.push({
        id: r.id,
        fileName: r.fileName,
        mimeType: r.mimeType,
        fileSizeKb: r.fileSizeKb,
        dataUrl: r.dataUrl,
        downloadUrl: r.downloadUrl,
        isImage: r.mimeType.startsWith('image/'),
        isPdf: r.mimeType === 'application/pdf',
        phase,
        uploadedAt: r.createdAt,
        uploadedBy: r.author,
        proposalName: 'Referencia de revisión',
      });
    });

    // 4 — Arte final
    const af = arteFinals
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (af) {
      entries.push({
        id: af.id,
        fileName: af.attachment.fileName,
        mimeType: af.attachment.mimeType,
        fileSizeKb: af.attachment.fileSizeKb,
        dataUrl: af.attachment.dataUrl,
        downloadUrl: af.attachment.downloadUrl,
        isImage: af.attachment.isImage,
        isPdf: af.attachment.isPdf,
        isZip: af.attachment.isZip,
        phase: 'Arte final',
        uploadedAt: af.createdAt,
        uploadedBy: af.uploadedBy,
        proposalName: 'Arte final aprobado',
      });
    }

    return entries;
  }, [project, designProposals, reviewRefAttachments, arteFinals, projectId]);

  // Group by phase maintaining workflow order
  const PHASE_DISPLAY_ORDER = [
    'Proyecto',
    'Diseño',
    'Aprobación Diseño',
    'Creación Desarrollo',
    'Validación diseño',
    'Aprobación Legal',
    'Arte final',
    'Aprobación final',
    'Aprobado',
  ];

  const grouped = useMemo(() => {
    const map = new Map<string, DocEntry[]>();
    allEntries.forEach((e) => {
      if (!map.has(e.phase)) map.set(e.phase, []);
      map.get(e.phase)!.push(e);
    });
    // Sort phases by workflow order
    return PHASE_DISPLAY_ORDER
    .filter((p) => map.has(p))
    .map((p) => ({ phase: p, entries: map.get(p)! }));
  }, [allEntries]);

  const handleDownloadAll = () => {
    allEntries.forEach((e) => {
      void downloadAttachment(e);
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-primary">Archivos del proyecto</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {allEntries.length} archivo{allEntries.length !== 1 ? 's' : ''} en{' '}
            {grouped.length} fase{grouped.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={allEntries.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={15} /> Descargar todos
        </button>
      </div>

      {grouped.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl shadow-sm flex flex-col items-center justify-center py-16 text-center px-8 gap-3">
          <FolderOpen size={36} className="text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Sin archivos todavía</p>
          <p className="text-xs text-slate-400 max-w-xs">
            Los archivos adjuntados en cada fase del proyecto aparecerán aquí clasificados automáticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ phase, entries }) => (
            <PhaseGroup
              key={phase}
              phase={phase}
              entries={entries}
              onPreviewPdf={setPdfPreview}
            />
          ))}
        </div>
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

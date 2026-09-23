import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GitBranch,
  GitCompare,
  Info,
  Maximize2,
  Move,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card';
import { PanZoomViewer } from '../../components/ui/PanZoomViewer';
import { useAppStore } from '../../store/useAppStore';
import { readFileAsDataUrl } from '../../utils/files';
import { renderPdfPage } from '../../utils/pdfRenderer';
import { computeImageDiff, type DiffResult } from '../../utils/imageDiff';

interface PanelImage {
  dataUrl: string;
  fileName: string;
  isAuto?: boolean; // loaded automatically from project data
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 6;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type FullscreenTarget =
  | { kind: 'p1'; src: string; title: string; subtitle?: string }
  | { kind: 'p2'; src: string; title: string; subtitle?: string }
  | { kind: 'diff'; src: string; title: string; subtitle?: string };

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function loadImageFromFile(file: File): Promise<{ dataUrl: string; fileName: string }> {
  const isPdf = file.type === 'application/pdf';
  if (!file.type.startsWith('image/') && !isPdf) {
    throw new Error('El archivo debe ser una imagen (JPG, PNG, WEBP) o un PDF.');
  }
  const raw = await readFileAsDataUrl(file);
  const dataUrl = isPdf ? await renderPdfPage(raw, 1) : raw;
  return { dataUrl, fileName: file.name };
}

// ─── Panel component ──────────────────────────────────────────────────────────

interface TripletPanelProps {
  index: number;
  title: string;
  subtitle?: string;
  scale: number;
  translate: { x: number; y: number };
  isPanning: boolean;
  divider?: boolean;
  imageSrc?: string;
  imageAlt?: string;
  onFullscreen?: () => void;
  emptyState: React.ReactNode;
  /** When provided, shows a floating "upload" overlay button */
  onUploadClick?: () => void;
  isDragOver?: boolean;
}

const TripletPanel: React.FC<TripletPanelProps> = ({
  index,
  title,
  subtitle,
  scale,
  translate,
  isPanning,
  divider,
  imageSrc,
  imageAlt,
  onFullscreen,
  emptyState,
  onUploadClick,
  isDragOver,
}) => (
  <div
    className={`relative bg-slate-100 ${divider ? 'lg:border-r border-border' : ''} ${
      isDragOver ? 'ring-2 ring-inset ring-accent/40 bg-accent/5' : ''
    }`}
  >
    {/* Header */}
    <div className="absolute top-0 left-0 right-0 z-10 px-3 py-2 bg-gradient-to-b from-white/90 to-white/0 pointer-events-none">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
        Panel {index} de 3
      </div>
      <div className="text-sm font-semibold text-primary truncate">{title}</div>
      {subtitle && (
        <div className="text-[11px] text-slate-500 truncate">{subtitle}</div>
      )}
    </div>

    {/* Surface */}
    <div className="relative h-[60vh] min-h-[360px] overflow-hidden">
      {imageSrc ? (
        <>
          <img
            src={imageSrc}
            alt={imageAlt ?? ''}
            draggable={false}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              maxWidth: 'calc(100% - 24px)',
              maxHeight: 'calc(100% - 88px)',
              objectFit: 'contain',
              transform: `translate(-50%, -50%) translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 120ms ease-out',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
          {/* Overlay buttons (fullscreen + replace upload) */}
          <div className="absolute top-2 right-2 z-20 flex gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
            {onUploadClick && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onUploadClick(); }}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/70 text-white hover:bg-slate-900 transition-colors text-[11px] font-medium"
                title="Reemplazar imagen"
              >
                <Upload size={12} /> Cambiar
              </button>
            )}
            {onFullscreen && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onFullscreen(); }}
                className="p-1.5 rounded-md bg-slate-900/70 text-white hover:bg-slate-900 transition-colors"
                title="Ampliar a pantalla completa"
              >
                <Maximize2 size={14} />
              </button>
            )}
          </div>
        </>
      ) : (
        emptyState
      )}
    </div>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

export const TabComparador = ({ projectId }: { projectId: string }) => {
  const { designProposals, arteFinals, projects } = useAppStore();
  const project = projects.find((p) => p.id === projectId);

  // ── Auto-source data ──────────────────────────────────────────────────────
  const latestArteFinal = useMemo(
    () =>
      arteFinals
        .filter((a) => a.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [arteFinals, projectId],
  );

  const latestProposal = useMemo(
    () =>
      designProposals
        .filter((d) => d.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [designProposals, projectId],
  );

  const autoP1 = useMemo(() => {
    if (latestArteFinal) {
      const att = latestArteFinal.attachment;
      return { dataUrl: att.dataUrl, fileName: att.fileName, isPdf: !!att.isPdf };
    }
    const img = latestProposal?.attachments.find((a) => a.isImage || a.isPdf);
    if (img) return { dataUrl: img.dataUrl, fileName: img.fileName, isPdf: !!img.isPdf };
    return null;
  }, [latestArteFinal, latestProposal]);

  const prevProject = useMemo(
    () =>
      project?.previousVersionId
        ? projects.find((p) => p.id === project.previousVersionId)
        : null,
    [project, projects],
  );

  const prevArteFinal = useMemo(() => {
    if (!prevProject) return null;
    return (
      arteFinals
        .filter((a) => a.projectId === prevProject.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }, [arteFinals, prevProject]);

  const autoP2Source = useMemo(() => {
    if (prevArteFinal) {
      const att = prevArteFinal.attachment;
      return { dataUrl: att.dataUrl, fileName: att.fileName, isPdf: !!att.isPdf };
    }
    const prevProposal = designProposals
      .filter((d) => d.projectId === prevProject?.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const img = prevProposal?.attachments.find((a) => a.isImage || a.isPdf);
    if (img) return { dataUrl: img.dataUrl, fileName: img.fileName, isPdf: !!img.isPdf };
    return null;
  }, [prevArteFinal, prevProject, designProposals]);

  // ── Panel images ──────────────────────────────────────────────────────────
  const [p1, setP1] = useState<PanelImage | null>(null);
  const [p2, setP2] = useState<PanelImage | null>(null);

  // Render PDF for autoP1 on mount
  const [p1Initialized, setP1Initialized] = useState(false);
  useEffect(() => {
    if (p1Initialized || !autoP1) { setP1Initialized(true); return; }
    const load = async () => {
      const dataUrl = autoP1.isPdf
        ? await renderPdfPage(autoP1.dataUrl, 1).catch(() => autoP1.dataUrl)
        : autoP1.dataUrl;
      setP1({ dataUrl, fileName: autoP1.fileName, isAuto: true });
      setP1Initialized(true);
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoP1, p1Initialized]);

  // Auto-load prev version for P2 if available
  const [p2Initialized, setP2Initialized] = useState(false);
  useEffect(() => {
    if (p2Initialized || !autoP2Source) { setP2Initialized(true); return; }
    const load = async () => {
      const dataUrl = autoP2Source.isPdf
        ? await renderPdfPage(autoP2Source.dataUrl, 1).catch(() => autoP2Source.dataUrl)
        : autoP2Source.dataUrl;
      setP2({ dataUrl, fileName: autoP2Source.fileName, isAuto: true });
      setP2Initialized(true);
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoP2Source, p2Initialized]);

  // ── Diff ──────────────────────────────────────────────────────────────────
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [threshold, setThreshold] = useState(40);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<FullscreenTarget | null>(null);

  // ── Drag state per panel ──────────────────────────────────────────────────
  const [dragOver1, setDragOver1] = useState(false);
  const [dragOver2, setDragOver2] = useState(false);

  // ── File inputs ───────────────────────────────────────────────────────────
  const fileInput1Ref = useRef<HTMLInputElement | null>(null);
  const fileInput2Ref = useRef<HTMLInputElement | null>(null);

  const handleFileForPanel = async (file: File | undefined, panel: 1 | 2) => {
    if (!file) return;
    try {
      setError(null);
      const img = await loadImageFromFile(file);
      if (panel === 1) { setP1({ ...img, isAuto: false }); }
      else { setP2({ ...img, isAuto: false }); }
      setDiffResult(null);
    } catch (e) {
      setError((e as Error).message ?? 'No se pudo leer el archivo');
    }
  };

  // ── Pan + zoom ────────────────────────────────────────────────────────────
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.18 : 0.18;
      setScale((s) => clamp(+(s + delta * s).toFixed(3), MIN_SCALE, MAX_SCALE));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onStripMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!p1 && !p2 && !diffResult) return;
    isPanningRef.current = true;
    panStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
    setPanning(true);
  };
  const onStripMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    setTranslate({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  };
  const onStripMouseUp = () => {
    if (isPanningRef.current) { isPanningRef.current = false; setPanning(false); }
  };

  const handleCompare = async () => {
    if (!p1 || !p2) return;
    setIsComputing(true);
    setError(null);
    try {
      const result = await computeImageDiff(p1.dataUrl, p2.dataUrl, threshold);
      setDiffResult(result);
    } catch (e) {
      setError((e as Error).message ?? 'No se pudo comparar las imágenes');
    } finally {
      setIsComputing(false);
    }
  };

  const reset = () => {
    setDiffResult(null);
    setError(null);
    setP1(autoP1 && !autoP1.isPdf ? { dataUrl: autoP1.dataUrl, fileName: autoP1.fileName, isAuto: true } : null);
    setP2(null);
    if (fileInput1Ref.current) fileInput1Ref.current.value = '';
    if (fileInput2Ref.current) fileInput2Ref.current.value = '';
    // Re-initialize from project data
    setP1Initialized(false);
    setP2Initialized(false);
  };
  const resetView = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  const diffPct = diffResult ? (diffResult.diff / diffResult.total) * 100 : 0;
  const diffSeverity =
    diffPct === 0 ? 'idle' : diffPct < 1 ? 'low' : diffPct < 5 ? 'mid' : 'high';

  // ── Upload drop zone (shared) ─────────────────────────────────────────────
  const makeDropZone = (panel: 1 | 2, _label: string, hint?: string) => {
    const setDragOver = panel === 1 ? setDragOver1 : setDragOver2;
    const isDragOver = panel === 1 ? dragOver1 : dragOver2;
    const inputRef = panel === 1 ? fileInput1Ref : fileInput2Ref;
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); void handleFileForPanel(e.dataTransfer.files?.[0], panel); }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        className={`absolute inset-3 mt-16 flex flex-col items-center justify-center text-center px-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
          isDragOver
            ? 'border-accent bg-accent/10'
            : 'border-slate-200 bg-white hover:border-accent hover:bg-accent/5'
        }`}
      >
        <Upload size={26} className="text-slate-400 mb-2" />
        <p className="text-sm text-slate-700">
          <span className="text-accent font-semibold">Haz clic para subir</span> o arrastra
        </p>
        <p className="text-xs text-slate-400 mt-1">JPG · PNG · WEBP · PDF</p>
        {hint && <p className="text-[11px] text-slate-400 mt-2">{hint}</p>}
        {isDragOver && (
          <p className="text-xs text-accent font-semibold mt-1">Suelta para cargar</p>
        )}
      </div>
    );
  };

  const p1Label = p1
    ? p1.isAuto
      ? latestArteFinal
        ? `Arte final · ${p1.fileName}`
        : `Propuesta diseño · ${p1.fileName}`
      : p1.fileName
    : 'Sin imagen';

  const p2Label = p2
    ? p2.isAuto
      ? `v. anterior · ${p2.fileName}`
      : p2.fileName
    : prevProject
      ? `Versión anterior disponible · ${prevProject.name}`
      : 'Sin imagen';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-primary">Comparador visual</h2>
        <p className="text-sm text-slate-500">
          Tríptico para confrontar dos imágenes. Arrastra y haz zoom: los tres paneles se mueven
          sincronizados.
        </p>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInput1Ref}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => void handleFileForPanel(e.target.files?.[0], 1)}
      />
      <input
        ref={fileInput2Ref}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => void handleFileForPanel(e.target.files?.[0], 2)}
      />

      {/* Upload strip above panels */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => fileInput1Ref.current?.click()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-200 hover:border-accent hover:bg-accent/5 text-sm font-medium text-slate-600 hover:text-accent transition-colors"
        >
          <Upload size={15} />
          {p1 ? `Panel 1: ${p1.fileName}` : 'Subir imagen Panel 1'}
        </button>
        <button
          type="button"
          onClick={() => fileInput2Ref.current?.click()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-200 hover:border-accent hover:bg-accent/5 text-sm font-medium text-slate-600 hover:text-accent transition-colors"
        >
          <Upload size={15} />
          {p2 ? `Panel 2: ${p2.fileName}` : 'Subir imagen Panel 2'}
        </button>
      </div>

      {prevProject && autoP2Source && !p2 && (
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <GitBranch size={13} />
          <span>
            Versión anterior disponible: <strong>{prevProject.name} v{prevProject.version}</strong>
            {' '}·{' '}
            <button
              type="button"
              onClick={() => setP2Initialized(false)}
              className="underline hover:text-blue-800"
            >
              Cargar en Panel 2
            </button>
          </span>
        </div>
      )}

      <Card className="overflow-hidden">
        <div
          ref={stripRef}
          onMouseDown={onStripMouseDown}
          onMouseMove={onStripMouseMove}
          onMouseUp={onStripMouseUp}
          onMouseLeave={onStripMouseUp}
          className={`relative grid grid-cols-1 lg:grid-cols-3 select-none ${
            panning
              ? 'cursor-grabbing'
              : p1 || p2 || diffResult
                ? 'cursor-grab'
                : 'cursor-default'
          }`}
        >
          {/* Panel 1 */}
          <TripletPanel
            index={1}
            title={latestArteFinal && p1?.isAuto ? 'Arte final' : p1?.isAuto ? 'Diseño' : 'Panel 1'}
            subtitle={p1Label}
            scale={scale}
            translate={translate}
            isPanning={panning}
            divider
            imageSrc={p1?.dataUrl}
            imageAlt={p1?.fileName}
            isDragOver={dragOver1}
            onUploadClick={() => fileInput1Ref.current?.click()}
            onFullscreen={
              p1
                ? () => setFullscreen({ kind: 'p1', src: p1.dataUrl, title: 'Panel 1', subtitle: p1Label })
                : undefined
            }
            emptyState={makeDropZone(1, 'Imagen de referencia (Panel 1)', autoP1 ? 'O cargando automáticamente desde el proyecto…' : undefined)}
          />

          {/* Panel 2 */}
          <TripletPanel
            index={2}
            title={p2?.isAuto ? 'Versión anterior' : 'Panel 2'}
            subtitle={p2Label}
            scale={scale}
            translate={translate}
            isPanning={panning}
            divider
            imageSrc={p2?.dataUrl}
            imageAlt={p2?.fileName}
            isDragOver={dragOver2}
            onUploadClick={() => fileInput2Ref.current?.click()}
            onFullscreen={
              p2
                ? () => setFullscreen({ kind: 'p2', src: p2.dataUrl, title: 'Panel 2', subtitle: p2Label })
                : undefined
            }
            emptyState={makeDropZone(2, 'Imagen a comparar (Panel 2)', prevProject ? `O carga la versión anterior: ${prevProject.name}` : undefined)}
          />

          {/* Panel 3 — diff */}
          <TripletPanel
            index={3}
            title="Diferencias detectadas"
            subtitle={
              diffResult
                ? `${diffResult.diff.toLocaleString()} px · ${diffPct.toFixed(2)}% del arte`
                : isComputing
                  ? 'Comparando píxeles…'
                  : 'Sin comparación todavía'
            }
            scale={scale}
            translate={translate}
            isPanning={panning}
            imageSrc={diffResult?.dataUrl}
            imageAlt="Diferencias"
            onFullscreen={
              diffResult
                ? () =>
                    setFullscreen({
                      kind: 'diff',
                      src: diffResult.dataUrl,
                      title: 'Diferencias detectadas',
                      subtitle: `${diffResult.diff.toLocaleString()} px · ${diffPct.toFixed(2)}% del arte`,
                    })
                : undefined
            }
            emptyState={
              isComputing ? (
                <div className="absolute inset-3 mt-16 flex flex-col items-center justify-center text-center px-6 rounded-xl border-2 border-dashed border-accent/40 bg-white text-slate-500">
                  <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-sm">Procesando diff…</p>
                </div>
              ) : (
                <div className="absolute inset-3 mt-16 flex flex-col items-center justify-center text-center px-6 rounded-xl border-2 border-dashed border-slate-200 bg-white text-slate-400">
                  <GitCompare size={28} className="opacity-50 mb-2" />
                  <p className="text-sm">Pulsa "Comparar" cuando hayas cargado ambas imágenes.</p>
                </div>
              )
            }
          />

          {/* Zoom hint */}
          {(p1 || p2 || diffResult) && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 text-[11px] text-slate-700 bg-white/85 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 pointer-events-none shadow-sm">
              <Move size={12} className="text-slate-500" />
              <span>Arrastra para mover · Rueda para zoom · {Math.round(scale * 100)}%</span>
            </div>
          )}
        </div>

        {/* Action bar */}
        <CardContent className="border-t border-border flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white">
          <div className="flex items-center gap-3 flex-wrap">
            <label
              htmlFor="diff-threshold"
              className="text-xs uppercase tracking-wide text-slate-500 font-semibold"
            >
              Sensibilidad
            </label>
            <input
              id="diff-threshold"
              type="range"
              min={5}
              max={200}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
              className="w-40 accent-[var(--color-accent,_#3b82f6)]"
            />
            <span className="text-xs font-mono text-slate-600 min-w-[40px] text-center">
              {threshold}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetView}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
              title="Reiniciar zoom"
            >
              <RotateCcw size={14} /> Vista
            </button>
            {(p1 || p2 || diffResult) && (
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
              >
                <X size={14} /> Limpiar todo
              </button>
            )}
            <button
              onClick={handleCompare}
              disabled={!p1 || !p2 || isComputing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GitCompare size={16} />
              {isComputing ? 'Comparando…' : 'Comparar'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Severity badge */}
      {diffResult && (
        <div
          className={`rounded-md text-xs px-4 py-3 border ${
            diffSeverity === 'high'
              ? 'bg-red-50 border-red-200 text-red-700'
              : diffSeverity === 'mid'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : diffSeverity === 'low'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-50 border-border text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
            {diffSeverity === 'idle'
              ? 'Las imágenes son idénticas para el umbral seleccionado.'
              : diffSeverity === 'low'
                ? 'Cambios mínimos detectados.'
                : diffSeverity === 'mid'
                  ? 'Cambios localizados detectados.'
                  : 'Cambios significativos detectados.'}
          </div>
          <div className="mt-1 text-[11px] opacity-80">
            Resolución: {diffResult.width}×{diffResult.height} px ·{' '}
            {diffResult.total.toLocaleString()} px evaluados.
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <PanZoomViewer
        open={!!fullscreen}
        src={fullscreen?.src ?? ''}
        alt={fullscreen?.title ?? ''}
        title={fullscreen?.title}
        subtitle={fullscreen?.subtitle}
        onClose={() => setFullscreen(null)}
      />
    </div>
  );
};

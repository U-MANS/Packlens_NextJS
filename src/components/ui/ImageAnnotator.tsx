import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Loader2,
  Maximize2,
  Minus,
  Move,
  Paperclip,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { DesignProposal, ProjectAttachment } from '../../types';
import { renderPdfPage } from '../../utils/pdfRenderer';
import { toast } from '../ui/Toast';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/dates';

interface ImageAnnotatorProps {
  open: boolean;
  attachment: ProjectAttachment;
  proposal: DesignProposal;
  projectId: string;
  readOnly?: boolean;
  onClose: () => void;
}

type PendingAnnotation = {
  tempId: string;
  text: string;
  position?: { x: number; y: number };
  page?: number;
  createdAt: string;
};

type DisplayAnnotation = {
  id: string;
  text: string;
  position?: { x: number; y: number };
  author: string;
  createdAt: string;
  pending: boolean;
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 6;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const ImageAnnotator: React.FC<ImageAnnotatorProps> = ({
  open,
  attachment,
  proposal,
  projectId,
  readOnly = false,
  onClose,
}) => {
  const {
    imageAnnotations,
    addImageAnnotation,
    deleteImageAnnotation,
    reviewRefAttachments,
    addReviewRefAttachment,
    removeReviewRefAttachment,
  } = useAppStore();
  const userName = useAuthStore((s) => s.user?.name) ?? 'Tú';

  const refAttachments = useMemo(
    () =>
      reviewRefAttachments.filter(
        (r) => r.proposalId === proposal.id && r.attachmentId === attachment.id,
      ),
    [reviewRefAttachments, proposal.id, attachment.id],
  );

  const refFileInputRef = useRef<HTMLInputElement | null>(null);

  const onRefFileChosen = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      void addReviewRefAttachment(projectId, proposal.id, file);
    });
    if (refFileInputRef.current) refFileInputRef.current.value = '';
  };

  const isPdf = !!(attachment.isPdf || attachment.mimeType === 'application/pdf');
  const totalPages = attachment.pageCount ?? 1;

  // ── PDF page state ────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!open || !isPdf) return;
    let cancelled = false;
    setIsRendering(true);
    setRenderedUrl(null);
    setImageLoaded(false);
    renderPdfPage(attachment.dataUrl, currentPage)
      .then((url) => {
        if (!cancelled) {
          setRenderedUrl(url);
          setIsRendering(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsRendering(false);
          setImageError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, isPdf, attachment.dataUrl, currentPage]);

  const displayUrl = isPdf ? renderedUrl : attachment.dataUrl;

  // ── Pending (unsaved) annotations ─────────────────────────────────────────
  const [pendingAnnotations, setPendingAnnotations] = useState<PendingAnnotation[]>([]);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  // ── Saved annotations for current page ────────────────────────────────────
  const savedAnnotations = useMemo(
    () =>
      imageAnnotations
        .filter(
          (a) =>
            a.attachmentId === attachment.id &&
            a.proposalId === proposal.id &&
            (isPdf ? (a.page ?? 1) === currentPage : true),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [imageAnnotations, attachment.id, proposal.id, isPdf, currentPage],
  );

  const pendingForPage = useMemo(
    () =>
      pendingAnnotations.filter((a) => (isPdf ? (a.page ?? 1) === currentPage : true)),
    [pendingAnnotations, isPdf, currentPage],
  );

  const annotations: DisplayAnnotation[] = useMemo(
    () => [
      ...savedAnnotations.map((a) => ({
        id: a.id,
        text: a.text,
        position: a.position,
        author: a.author,
        createdAt: a.createdAt,
        pending: false,
      })),
      ...pendingForPage.map((a) => ({
        id: a.tempId,
        text: a.text,
        position: a.position,
        author: userName,
        createdAt: a.createdAt,
        pending: true,
      })),
    ],
    [savedAnnotations, pendingForPage, userName],
  );

  // ── Generic interaction state ─────────────────────────────────────────────
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [draftText, setDraftText] = useState('');
  const [draftPosition, setDraftPosition] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<'idle' | 'editing' | 'placing'>('idle');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const hasUnsaved =
    pendingAnnotations.length > 0 || draftText.trim().length > 0 || mode !== 'idle';

  const requestClose = () => {
    if (!readOnly && hasUnsaved) {
      setConfirmCloseOpen(true);
      return;
    }
    onClose();
  };

  const confirmDiscardAndClose = () => {
    setConfirmCloseOpen(false);
    setPendingAnnotations([]);
    setDraftText('');
    setDraftPosition(null);
    setMode('idle');
    onClose();
  };

  // Reset when opening or switching attachment
  useEffect(() => {
    if (!open) return;
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setDraftText('');
    setDraftPosition(null);
    setMode('idle');
    setHoveredId(null);
    setImageError(false);
    setImageLoaded(false);
    setCurrentPage(1);
    setPendingAnnotations([]);
    setConfirmCloseOpen(false);
    setSavingAll(false);
    if (!isPdf) setRenderedUrl(null);
  }, [open, attachment.id, isPdf]);

  // Reset view when page changes
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setMode('idle');
    setDraftText('');
    setDraftPosition(null);
  }, [currentPage]);

  // ESC closes (with unsaved check)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmCloseOpen) {
          setConfirmCloseOpen(false);
          return;
        }
        if (mode === 'placing') {
          setMode(draftText ? 'editing' : 'idle');
          return;
        }
        requestClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, draftText, confirmCloseOpen, hasUnsaved, readOnly, onClose]);

  // Wheel zoom
  useEffect(() => {
    if (!open) return;
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.18 : 0.18;
      setScale((s) => clamp(+(s + delta * s).toFixed(3), MIN_SCALE, MAX_SCALE));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (mode === 'placing') return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-annotation-pin]')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setTranslate({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  };
  const onMouseUp = () => {
    isPanning.current = false;
  };

  const resetView = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (mode !== 'placing') return;
    if (!frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    setDraftPosition({ x, y });
    setMode('editing');
    requestAnimationFrame(() => draftRef.current?.focus());
  };

  const startAdding = () => {
    if (readOnly) return;
    setMode('editing');
    setDraftText('');
    setDraftPosition(null);
    requestAnimationFrame(() => draftRef.current?.focus());
  };

  const cancelDraft = () => {
    setMode('idle');
    setDraftText('');
    setDraftPosition(null);
  };

  const togglePlacing = () => {
    if (readOnly) return;
    setMode((m) => (m === 'placing' ? 'editing' : 'placing'));
  };

  /** Añade el borrador a la lista local (aún no persiste en BD). */
  const addDraftToPending = () => {
    const text = draftText.trim();
    if (!text) return;
    setPendingAnnotations((prev) => [
      ...prev,
      {
        tempId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        position: draftPosition ?? undefined,
        page: isPdf ? currentPage : undefined,
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraftText('');
    setDraftPosition(null);
    setMode('idle');
  };

  const removePending = (tempId: string) => {
    setPendingAnnotations((prev) => prev.filter((a) => a.tempId !== tempId));
  };

  /** Persiste en BD todos los comentarios pendientes. */
  const saveAllComments = async () => {
    if (savingAll || readOnly) return;

    // Si hay un borrador abierto con texto, inclúyelo antes de guardar
    let toSave = pendingAnnotations;
    const draft = draftText.trim();
    if (draft) {
      const extra: PendingAnnotation = {
        tempId: `pending-${Date.now()}`,
        text: draft,
        position: draftPosition ?? undefined,
        page: isPdf ? currentPage : undefined,
        createdAt: new Date().toISOString(),
      };
      toSave = [...pendingAnnotations, extra];
    }

    if (toSave.length === 0) {
      toast.show('No hay comentarios nuevos que guardar.', { type: 'phase' });
      return;
    }

    setSavingAll(true);
    try {
      for (const item of toSave) {
        await addImageAnnotation({
          projectId,
          proposalId: proposal.id,
          attachmentId: attachment.id,
          text: item.text,
          position: item.position,
          page: item.page,
        });
      }
      setPendingAnnotations([]);
      setDraftText('');
      setDraftPosition(null);
      setMode('idle');
      toast.success(
        toSave.length === 1
          ? 'Comentario guardado correctamente'
          : `${toSave.length} comentarios guardados correctamente`,
        { duration: 4000 },
      );
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error al guardar los comentarios'));
    } finally {
      setSavingAll(false);
    }
  };

  if (!open) return null;

  const cursorClass =
    mode === 'placing' ? 'cursor-crosshair' : isPanning.current ? 'cursor-grabbing' : 'cursor-grab';

  const pendingCount = pendingAnnotations.length + (draftText.trim() ? 1 : 0);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-sm">
      <div className="relative w-full h-full max-w-[96vw] max-h-[96vh] bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
        {/* ── Image canvas ─────────────────────────────────────────────────── */}
        <div className="relative flex-1 min-h-[280px] lg:min-h-0 bg-[radial-gradient(circle_at_30%_30%,#1e293b_0%,#020617_75%)]">
          {/* Header bar */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-b from-slate-950/80 to-transparent text-white">
            <div className="min-w-0 flex items-center gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{attachment.fileName}</p>
                <p className="text-xs text-white/60 truncate">
                  {proposal.name} · {proposal.version}
                  {isPdf && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-white/80 font-mono text-[10px]">
                      PDF · {totalPages} pág.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setScale((s) => clamp(+(s - 0.25).toFixed(2), MIN_SCALE, MAX_SCALE))}
                className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Reducir"
              >
                <Minus size={16} />
              </button>
              <span className="text-xs font-mono text-white/80 min-w-[44px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => clamp(+(s + 0.25).toFixed(2), MIN_SCALE, MAX_SCALE))}
                className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Ampliar"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={resetView}
                className="p-2 ml-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Restablecer vista"
              >
                <RotateCcw size={16} />
              </button>
              {/* X solo en móvil; en escritorio está en el panel blanco */}
              <button
                onClick={requestClose}
                className="p-2 ml-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors lg:hidden"
                title="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {isPdf && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 transition-colors"
                title="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-mono text-white/90 select-none">
                Pág. {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 transition-colors"
                title="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 text-[11px] text-white/70 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
            <Move size={12} />
            <span>
              Arrastra para mover · Rueda del ratón para zoom
              {mode === 'placing' && ' · Click en la imagen para fijar el comentario'}
            </span>
          </div>

          {mode === 'placing' && (
            <div className="absolute inset-0 z-[5] pointer-events-none">
              <div className="absolute top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-accent text-white text-xs font-medium shadow-lg flex items-center gap-2">
                <Crosshair size={12} /> Click en la imagen para colocar el pin
              </div>
            </div>
          )}

          <div
            ref={canvasRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onClick={onCanvasClick}
            className={`absolute inset-0 overflow-hidden select-none ${cursorClass}`}
          >
            <div
              style={{
                transform: `translate(-50%, -50%) translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: isPanning.current ? 'none' : 'transform 120ms ease-out',
              }}
              className="absolute top-1/2 left-1/2 will-change-transform"
            >
              <div ref={frameRef} className="relative">
                {displayUrl && (
                  <img
                    src={displayUrl}
                    alt={attachment.fileName}
                    draggable={false}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                    style={{ maxWidth: '78vw', maxHeight: '76vh' }}
                    className="block w-auto h-auto object-contain pointer-events-none bg-slate-800/40 rounded-md"
                  />
                )}

                {draftPosition && imageLoaded && (
                  <div
                    className="absolute"
                    style={{
                      left: `${draftPosition.x * 100}%`,
                      top: `${draftPosition.y * 100}%`,
                      transform: `translate(-50%, -50%) scale(${1 / scale})`,
                    }}
                  >
                    <div className="w-7 h-7 rounded-full bg-amber-400 text-amber-950 border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold animate-pulse">
                      ?
                    </div>
                  </div>
                )}

                {imageLoaded &&
                  annotations.map((a, i) => {
                    if (!a.position) return null;
                    const isHovered = hoveredId === a.id;
                    return (
                      <div
                        key={a.id}
                        data-annotation-pin
                        className="absolute"
                        style={{
                          left: `${a.position.x * 100}%`,
                          top: `${a.position.y * 100}%`,
                          transform: `translate(-50%, -50%) scale(${1 / scale})`,
                        }}
                        onMouseEnter={() => setHoveredId(a.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHoveredId(a.id);
                          }}
                          className={`w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold text-white transition-transform ${
                            a.pending
                              ? isHovered
                                ? 'bg-amber-500 scale-110'
                                : 'bg-amber-400'
                              : isHovered
                                ? 'bg-accent scale-110'
                                : 'bg-accent-hover'
                          }`}
                        >
                          {i + 1}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>

            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm pointer-events-none">
                <div className="bg-red-900/60 border border-red-500/60 rounded-md px-4 py-3 text-center max-w-sm">
                  No se pudo cargar la imagen.
                  <div className="text-xs text-white/60 mt-1 font-mono break-all">
                    {attachment.fileName}
                  </div>
                </div>
              </div>
            )}
            {(isRendering || (!imageLoaded && !imageError && displayUrl)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 text-sm pointer-events-none gap-2">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                {isRendering ? `Renderizando página ${currentPage}…` : 'Cargando…'}
              </div>
            )}
            {!displayUrl && !isRendering && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm pointer-events-none">
                Cargando…
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="lg:w-[360px] w-full lg:max-h-none max-h-[45vh] bg-white border-t lg:border-t-0 lg:border-l border-border flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Maximize2 size={14} className="text-slate-400" />
                Comentarios sobre el arte
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {annotations.length} comentario{annotations.length === 1 ? '' : 's'}
                {isPdf && ` en pág. ${currentPage}`}
                {pendingAnnotations.length > 0 && (
                  <span className="text-amber-600 font-medium">
                    {' '}
                    · {pendingAnnotations.length} sin guardar
                  </span>
                )}
              </p>
            </div>
            {/* X en zona blanca (escritorio y también refuerzo visual) */}
            <button
              type="button"
              onClick={requestClose}
              className="hidden lg:inline-flex shrink-0 p-2 rounded-lg border border-border text-slate-500 hover:text-primary hover:bg-slate-50 hover:border-slate-300 transition-colors"
              title="Cerrar"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
            {annotations.length === 0 && mode === 'idle' && (
              <p className="text-xs text-slate-400 px-1 py-2">
                {isPdf
                  ? `Sin comentarios en la página ${currentPage}.`
                  : 'Aún no hay comentarios sobre esta imagen.'}
              </p>
            )}

            {annotations.map((a, i) => (
              <article
                key={a.id}
                onMouseEnter={() => setHoveredId(a.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`group flex items-start gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
                  hoveredId === a.id
                    ? a.pending
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-accent bg-accent/5'
                    : a.pending
                      ? 'border-amber-200 bg-amber-50/60'
                      : 'border-border bg-white hover:border-slate-300'
                }`}
              >
                {a.position ? (
                  <span
                    className={`shrink-0 mt-0.5 w-6 h-6 rounded-full text-white text-[11px] font-bold flex items-center justify-center ${
                      a.pending ? 'bg-amber-500' : 'bg-accent'
                    }`}
                  >
                    {i + 1}
                  </span>
                ) : (
                  <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-medium">
                    ·
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-primary leading-snug">{a.text}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {a.author} · {formatDateTime(a.createdAt)}
                    {a.pending && (
                      <span className="ml-1.5 text-amber-600 font-medium">Sin guardar</span>
                    )}
                  </p>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => {
                      if (a.pending) removePending(a.id);
                      else void deleteImageAnnotation(a.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-red-500"
                    title="Eliminar comentario"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </article>
            ))}

            {!readOnly && (
              <AddAnnotationCard
                mode={mode}
                draftText={draftText}
                draftPosition={draftPosition}
                onTextChange={setDraftText}
                onStart={startAdding}
                onPlace={togglePlacing}
                onAdd={addDraftToPending}
                onCancel={cancelDraft}
                onClearPin={() => setDraftPosition(null)}
                draftRef={draftRef}
              />
            )}
          </div>

          {!readOnly && (
            <div className="border-t border-border px-4 py-3 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                  <Paperclip size={11} /> Adjuntos de referencia
                </span>
                <button
                  type="button"
                  onClick={() => refFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover px-2 py-1 rounded-md border border-accent/30 hover:bg-accent/5 transition-colors"
                  title="Añadir archivo de referencia"
                >
                  <Upload size={11} /> Añadir
                </button>
                <input
                  ref={refFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.ai,.eps"
                  className="hidden"
                  onChange={(e) => onRefFileChosen(e.target.files)}
                />
              </div>
              {refAttachments.length === 0 ? (
                <p className="text-[11px] text-slate-400">Sin archivos de referencia.</p>
              ) : (
                <ul className="space-y-1.5 max-h-28 overflow-y-auto">
                  {refAttachments.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-xs text-slate-700">
                      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center font-bold text-[9px] text-slate-500 shrink-0">
                        {r.mimeType.includes('pdf')
                          ? 'PDF'
                          : (r.fileName.split('.').pop()?.toUpperCase().slice(0, 3) ?? '?')}
                      </div>
                      <span className="flex-1 truncate" title={r.fileName}>
                        {r.fileName}
                      </span>
                      <span className="text-slate-400 shrink-0">{r.fileSizeKb} KB</span>
                      <button
                        type="button"
                        onClick={() => void removeReviewRefAttachment(r.id)}
                        className="p-0.5 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                        title="Eliminar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Footer: Guardar / Cancelar */}
          {!readOnly && (
            <div className="border-t border-border px-4 py-3 shrink-0 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={requestClose}
                disabled={savingAll}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-primary rounded-md border border-border bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveAllComments()}
                disabled={savingAll || pendingCount === 0}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white rounded-md bg-accent hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingAll ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Guardando…
                  </>
                ) : (
                  'Guardar comentarios'
                )}
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Confirmación al cerrar con cambios sin guardar */}
      {confirmCloseOpen && (
        <div
          className="absolute inset-0 z-[70] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-comments-title"
        >
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-border p-5 space-y-4">
            <h4 id="unsaved-comments-title" className="text-base font-semibold text-primary">
              Hay comentarios sin guardar
            </h4>
            <p className="text-sm text-slate-600">
              ¿Quieres cerrar la ventana? Se perderán los comentarios que aún no has guardado.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmCloseOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-primary rounded-md border border-border hover:bg-slate-50 transition-colors"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmDiscardAndClose}
                className="px-3 py-2 text-sm font-semibold text-white rounded-md bg-red-600 hover:bg-red-700 transition-colors"
              >
                Sí, cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};

// ── AddAnnotationCard ─────────────────────────────────────────────────────────

interface AddAnnotationCardProps {
  mode: 'idle' | 'editing' | 'placing';
  draftText: string;
  draftPosition: { x: number; y: number } | null;
  onTextChange: (v: string) => void;
  onStart: () => void;
  onPlace: () => void;
  onAdd: () => void;
  onCancel: () => void;
  onClearPin: () => void;
  draftRef: React.RefObject<HTMLTextAreaElement | null>;
}

const AddAnnotationCard: React.FC<AddAnnotationCardProps> = ({
  mode,
  draftText,
  draftPosition,
  onTextChange,
  onStart,
  onPlace,
  onAdd,
  onCancel,
  onClearPin,
  draftRef,
}) => {
  const isActive = mode === 'editing' || mode === 'placing';
  const isPlacing = mode === 'placing';

  return (
    <div
      onClick={() => !isActive && onStart()}
      className={`px-3 py-2.5 rounded-lg border transition-colors ${
        isActive
          ? 'border-accent bg-white shadow-sm'
          : 'border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-accent hover:bg-accent/5 cursor-pointer'
      }`}
    >
      {!isActive ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium flex items-center gap-2">
            <Plus size={14} /> Añadir comentario
          </span>
          <Crosshair size={14} className="text-slate-400" />
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onPlace}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                isPlacing
                  ? 'bg-accent text-white'
                  : draftPosition
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title={draftPosition ? 'Pin colocado · Click para reubicar' : 'Fijar en la imagen'}
            >
              <Crosshair size={12} />
              {isPlacing
                ? 'Click en la imagen…'
                : draftPosition
                  ? `Pin (${Math.round(draftPosition.x * 100)}%, ${Math.round(draftPosition.y * 100)}%)`
                  : 'Fijar en imagen'}
            </button>
            {draftPosition && !isPlacing && (
              <button
                type="button"
                onClick={onClearPin}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                Quitar pin
              </button>
            )}
          </div>
          <textarea
            ref={draftRef}
            value={draftText}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Escribe la observación, normativa que afecta, claim a corregir…"
            rows={3}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onAdd();
            }}
            className="w-full px-2.5 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-medium text-slate-500 hover:text-primary px-2 py-1 transition-colors"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={onAdd}
              disabled={!draftText.trim()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-800 text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Añadir
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Se añadirá a la lista. Usa «Guardar comentarios» para persistirlo.
          </p>
        </div>
      )}
    </div>
  );
};

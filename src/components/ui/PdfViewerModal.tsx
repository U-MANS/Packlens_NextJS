import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';

import { getPdfPageCount, renderPdfPage } from '../../utils/pdfRenderer';

interface PdfViewerModalProps {
  open: boolean;
  fileName: string;
  dataUrl: string;
  pageCount?: number;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  open,
  fileName,
  dataUrl,
  pageCount: pageCountProp,
  onClose,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(pageCountProp ?? 1);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCurrentPage(1);
    setRenderedUrl(null);
    setError(null);

    if (pageCountProp && pageCountProp > 0) {
      setTotalPages(pageCountProp);
      return;
    }

    let cancelled = false;
    getPdfPageCount(dataUrl)
      .then((count) => {
        if (!cancelled) setTotalPages(Math.max(1, count));
      })
      .catch(() => {
        if (!cancelled) setTotalPages(1);
      });
    return () => {
      cancelled = true;
    };
  }, [open, dataUrl, pageCountProp]);

  useEffect(() => {
    if (!open || !dataUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRenderedUrl(null);

    renderPdfPage(dataUrl, currentPage, 2)
      .then((url) => {
        if (!cancelled) {
          setRenderedUrl(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('No se pudo renderizar el PDF.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, dataUrl, currentPage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrentPage((p) => Math.max(1, p - 1));
      if (e.key === 'ArrowRight') setCurrentPage((p) => Math.min(totalPages, p + 1));
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, totalPages]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-primary truncate">{fileName}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Vista previa PDF · Página {currentPage} de {totalPages}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg border border-border text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative flex-1 min-h-[320px] bg-slate-100 flex items-center justify-center overflow-auto p-4">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-slate-500 text-sm">
              <Loader2 size={24} className="animate-spin text-accent" />
              Cargando página…
            </div>
          )}
          {error && !loading && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}
          {renderedUrl && !loading && (
            <img
              src={renderedUrl}
              alt={`${fileName} — página ${currentPage}`}
              className="max-w-full max-h-[70vh] object-contain shadow-lg rounded-md bg-white"
            />
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-border bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <span className="text-sm font-mono text-slate-600">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

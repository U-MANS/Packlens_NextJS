import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Move, Plus, RotateCcw, X } from 'lucide-react';

interface PanZoomViewerProps {
  open: boolean;
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 8;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Visor de imagen a pantalla casi completa con pan (drag) y zoom (rueda + botones).
 * Estado interno independiente — pensado para vistas "ampliar" sueltas.
 */
export const PanZoomViewer: React.FC<PanZoomViewerProps> = ({
  open,
  src,
  alt,
  title,
  subtitle,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [open, src]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

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

  if (!open) return null;

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
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

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-sm">
      <div className="relative w-full h-full max-w-[96vw] max-h-[96vh] bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 text-white">
          <div className="min-w-0">
            {title && <p className="text-sm font-semibold truncate">{title}</p>}
            {subtitle && <p className="text-xs text-white/60 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setScale((s) => clamp(+(s - 0.25).toFixed(2), MIN_SCALE, MAX_SCALE))
              }
              className="p-2 rounded-md bg-white/10 hover:bg-white/20"
              title="Reducir"
            >
              <Minus size={16} />
            </button>
            <span className="text-xs font-mono text-white/80 min-w-[48px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() =>
                setScale((s) => clamp(+(s + 0.25).toFixed(2), MIN_SCALE, MAX_SCALE))
              }
              className="p-2 rounded-md bg-white/10 hover:bg-white/20"
              title="Ampliar"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => {
                setScale(1);
                setTranslate({ x: 0, y: 0 });
              }}
              className="p-2 ml-1 rounded-md bg-white/10 hover:bg-white/20"
              title="Restablecer"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 ml-1 rounded-md bg-white/10 hover:bg-white/20"
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          className={`relative flex-1 overflow-hidden select-none ${
            isPanning.current ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <div
            className="absolute top-1/2 left-1/2 will-change-transform"
            style={{
              transform: `translate(-50%, -50%) translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isPanning.current ? 'none' : 'transform 120ms ease-out',
            }}
          >
            <img
              src={src}
              alt={alt}
              draggable={false}
              style={{ maxWidth: '92vw', maxHeight: '82vh' }}
              className="block w-auto h-auto pointer-events-none rounded-md bg-slate-800/40"
            />
          </div>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 text-[11px] text-white/70 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 pointer-events-none">
            <Move size={12} />
            <span>Arrastra para mover · Rueda para zoom</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

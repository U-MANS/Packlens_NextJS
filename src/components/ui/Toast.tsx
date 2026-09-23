/**
 * Toast system — singleton + React component.
 * Uso: importar `toast` desde cualquier módulo y llamar a `toast.show(...)`.
 * Montar <Toaster /> una vez en el árbol (Layout).
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, Megaphone, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'phase' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  /** Departamento / equipo notificado. */
  department?: string;
  type: ToastType;
}

// ─── Singleton pub/sub ───────────────────────────────────────────────────────

type Listener = (toasts: ToastItem[]) => void;
const listeners = new Set<Listener>();
let currentToasts: ToastItem[] = [];

const notify = () => listeners.forEach((l) => l([...currentToasts]));

const remove = (id: string) => {
  currentToasts = currentToasts.filter((t) => t.id !== id);
  notify();
};

export const toast = {
  show: (
    message: string,
    opts?: { department?: string; type?: ToastType; duration?: number },
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = {
      id,
      message,
      department: opts?.department,
      type: opts?.type ?? 'info',
    };
    currentToasts = [...currentToasts, item];
    notify();
    setTimeout(() => remove(id), opts?.duration ?? 5000);
    return id;
  },

  dismiss: (id: string) => remove(id),

  error: (message: string, opts?: { duration?: number }) =>
    toast.show(message, { type: 'error', duration: opts?.duration ?? 7000 }),

  success: (message: string, opts?: { duration?: number }) =>
    toast.show(message, { type: 'success', duration: opts?.duration ?? 5000 }),
};

// ─── Hook ────────────────────────────────────────────────────────────────────

function useToasts(): ToastItem[] {
  const [items, setItems] = useState<ToastItem[]>([...currentToasts]);
  useEffect(() => {
    const handler = (t: ToastItem[]) => setItems(t);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);
  return items;
}

// ─── Single toast card ───────────────────────────────────────────────────────

const COLORS: Record<ToastType, { bar: string; bg: string; icon: string }> = {
  success: { bar: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-600' },
  info: { bar: 'bg-blue-500', bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-600' },
  phase: { bar: 'bg-accent', bg: 'bg-white border-border shadow-lg', icon: 'text-accent' },
  error: { bar: 'bg-red-500', bg: 'bg-red-50 border-red-200', icon: 'text-red-600' },
};

const Icon: React.FC<{ type: ToastType }> = ({ type }) => {
  const cls = `${COLORS[type].icon} shrink-0`;
  if (type === 'success') return <CheckCircle2 size={18} className={cls} />;
  if (type === 'phase') return <Megaphone size={18} className={cls} />;
  if (type === 'error') return <AlertCircle size={18} className={cls} />;
  return <Info size={18} className={cls} />;
};

const ToastCard: React.FC<{ item: ToastItem; onDismiss: () => void }> = ({ item, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation after mount
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const c = COLORS[item.type];
  return (
    <div
      role="alert"
      className={`relative overflow-hidden flex items-start gap-3 rounded-xl border px-4 py-3.5 pr-10 w-96 shadow-xl transition-all duration-300 ${c.bg} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      {/* Accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${c.bar}`} />

      <Icon type={item.type} />

      <div className="flex-1 min-w-0 pl-0.5">
        <p className="text-sm font-semibold text-primary leading-snug">{item.message}</p>
        {item.department && (
          <p className="text-xs text-slate-500 mt-0.5">
            Notificado: <span className="font-medium text-slate-700">{item.department}</span>
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// ─── Toaster (mount once in Layout) ─────────────────────────────────────────

export const Toaster: React.FC = () => {
  const items = useToasts();

  return createPortal(
    <div
      aria-live="polite"
      className="fixed inset-x-0 top-6 z-[100000] flex flex-col items-center gap-2.5 pointer-events-none"
    >
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastCard item={item} onDismiss={() => toast.dismiss(item.id)} />
        </div>
      ))}
    </div>,
    document.body,
  );
};

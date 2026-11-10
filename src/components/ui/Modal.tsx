import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Impide cerrar con Escape, overlay o botón X (p. ej. mientras hay un envío en curso). */
  preventClose?: boolean;
}

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  preventClose = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusFirst = () => {
      const first = dialog?.querySelector<HTMLElement>(focusableSelector);
      (first ?? dialog)?.focus();
    };
    focusFirst();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventClose) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, preventClose]);

  if (!open) return null;

  const handleClose = () => {
    if (!preventClose) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative w-full ${sizeMap[size]} bg-surface rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh] outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="px-6 pt-5 pb-4 border-b border-border flex items-start justify-between gap-4">
            <div>
              {title && (
                <h2 id={titleId} className="text-lg font-semibold text-primary">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="text-sm text-slate-500 mt-1">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              disabled={preventClose}
              className="text-slate-400 hover:text-primary transition-colors p-1 -m-1 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-border bg-slate-50/60 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

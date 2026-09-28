'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

function computeDropdownStyle(
  buttonEl: HTMLButtonElement,
  panelEl: HTMLDivElement,
): React.CSSProperties {
  const rect = buttonEl.getBoundingClientRect();
  const gap = 4;

  panelEl.style.position = 'fixed';
  panelEl.style.left = `${rect.left}px`;
  panelEl.style.width = `${rect.width}px`;
  panelEl.style.top = '-9999px';
  panelEl.style.visibility = 'hidden';

  const height = panelEl.offsetHeight;
  let top = rect.bottom + gap;
  if (top + height > window.innerHeight - gap) {
    top = Math.max(gap, rect.top - height - gap);
  }

  return {
    position: 'fixed',
    top,
    left: rect.left,
    width: rect.width,
    zIndex: 9999,
    visibility: 'visible',
  };
}

type MultiSelectDropdownProps = {
  options: string[];
  selected: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
  disabled?: boolean;
};

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selected,
  placeholder,
  onChange,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !panelRef.current) return;
    setPanelStyle(computeDropdownStyle(buttonRef.current, panelRef.current));
  }, [open, options.length]);

  useEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected[0]} +${selected.length - 1} más`;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 bg-white border rounded-md text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? 'border-accent ring-2 ring-accent/20 text-primary'
            : 'border-border text-primary hover:border-slate-400'
        }`}
      >
        <span className={`truncate ${selected.length === 0 ? 'text-slate-400' : ''}`}>{label}</span>
        <ChevronDown
          size={15}
          className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={
              panelStyle ?? {
                position: 'fixed',
                top: -9999,
                left: 0,
                width: buttonRef.current?.offsetWidth ?? 0,
                visibility: 'hidden',
              }
            }
            className="bg-white border border-border rounded-lg shadow-lg py-1 max-h-52 overflow-y-auto"
          >
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">Sin opciones disponibles</p>
            ) : (
              options.map((opt) => {
                const active = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors"
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        active ? 'bg-accent border-accent' : 'border-slate-300'
                      }`}
                    >
                      {active && <Check size={11} className="text-white" />}
                    </span>
                    <span className={active ? 'font-medium text-primary' : 'text-slate-700'}>
                      {opt}
                    </span>
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

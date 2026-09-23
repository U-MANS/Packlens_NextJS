'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

import { parseDisplayDate, toDisplayDate } from '../../utils/dates';

type DateInputProps = {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
};

/**
 * Campo de fecha en dd/mm/yyyy.
 * El valor controlado sigue siendo yyyy-mm-dd (compatible con forms / API).
 */
export function DateInput({
  value,
  onChange,
  className = '',
  id,
  name,
  required,
  disabled,
  min,
  max,
  placeholder = 'dd/mm/yyyy',
}: DateInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => toDisplayDate(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(toDisplayDate(value));
  }, [value, focused]);

  const commitText = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange('');
      setText('');
      return;
    }
    const iso = parseDisplayDate(trimmed);
    if (iso) {
      onChange(iso);
      setText(toDisplayDate(iso));
      return;
    }
    setText(toDisplayDate(value));
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el || disabled) return;
    try {
      el.showPicker?.();
    } catch {
      el.click();
    }
  };

  return (
    <div className="relative">
      <input
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commitText(text);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        className={`${className} pr-10`.trim()}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openPicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-primary disabled:opacity-40"
        aria-label="Abrir calendario"
      >
        <Calendar size={16} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={value || ''}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setText(toDisplayDate(e.target.value));
        }}
        className="pointer-events-none absolute opacity-0 w-0 h-0 overflow-hidden"
      />
    </div>
  );
}

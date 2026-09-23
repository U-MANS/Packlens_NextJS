/**
 * Formato de fechas de UI: dd/mm/yyyy (y dd/mm/yyyy HH:mm para fecha+hora).
 * Los valores ISO internos (API / store) no se modifican.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseToDate(iso: string): Date | null {
  const trimmed = iso.trim();
  const only = DATE_ONLY.exec(trimmed);
  if (only) {
    const y = Number(only[1]);
    const m = Number(only[2]);
    const d = Number(only[3]);
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** dd/mm/yyyy */
export function formatDate(iso?: string | null, fallback = '—'): string {
  if (!iso) return fallback;
  const only = DATE_ONLY.exec(iso.trim());
  if (only) return `${only[3]}/${only[2]}/${only[1]}`;
  const date = parseToDate(iso);
  if (!date) return fallback;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** dd/mm/yyyy HH:mm */
export function formatDateTime(iso?: string | null, fallback = '—'): string {
  if (!iso) return fallback;
  const date = parseToDate(iso);
  if (!date) return fallback;
  return `${formatDate(iso)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

const DISPLAY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Convierte dd/mm/yyyy → yyyy-mm-dd (o null si no es válida). */
export function parseDisplayDate(display: string): string | null {
  const m = DISPLAY_DATE.exec(display.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return null;
  }
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

/** yyyy-mm-dd → dd/mm/yyyy (cadena vacía si no hay valor). */
export function toDisplayDate(iso?: string | null): string {
  if (!iso) return '';
  return formatDate(iso, '');
}

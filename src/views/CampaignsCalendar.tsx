'use client';

import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Megaphone,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { DateInput } from '../components/ui/DateInput';
import {
  fileToDataUrl,
  nextCampaignColor,
  useLocalCampaignsStore,
  type LocalCampaign,
  type LocalCampaignMedia,
} from '../store/useLocalCampaignsStore';
import { formatDate } from '../utils/dates';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MAX_MEDIA = 6;
const MAX_FILE_MB = 25;

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Lunes = 0 … Domingo = 6 */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

function isMediaImage(mime: string) {
  return mime.startsWith('image/');
}

function isMediaVideo(mime: string) {
  return mime.startsWith('video/');
}

type DraftMedia = LocalCampaignMedia;

type FormState = {
  name: string;
  startDate: string;
  endDate: string;
  notes: string;
  media: DraftMedia[];
};

const emptyForm = (today = new Date()): FormState => {
  const start = toISODate(today);
  const end = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6));
  return { name: '', startDate: start, endDate: end, notes: '', media: [] };
};

export default function CampaignsCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LocalCampaign | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const campaigns = useLocalCampaignsStore((s) => s.campaigns);
  const hydrated = useLocalCampaignsStore((s) => s.hydrated);
  const addCampaign = useLocalCampaignsStore((s) => s.addCampaign);
  const updateCampaign = useLocalCampaignsStore((s) => s.updateCampaign);
  const removeCampaign = useLocalCampaignsStore((s) => s.removeCampaign);

  const monthStartIso = toISODate(startOfMonth(year, month));
  const monthEndIso = toISODate(new Date(year, month, daysInMonth(year, month)));

  const monthCampaigns = useMemo(
    () =>
      campaigns
        .filter((c) => rangesOverlap(c.startDate, c.endDate, monthStartIso, monthEndIso))
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name)),
    [campaigns, monthStartIso, monthEndIso],
  );

  const cells = useMemo(() => {
    const totalDays = daysInMonth(year, month);
    const offset = mondayIndex(startOfMonth(year, month));
    const result: { date: Date | null; iso: string | null }[] = [];
    for (let i = 0; i < offset; i++) result.push({ date: null, iso: null });
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      result.push({ date, iso: toISODate(date) });
    }
    while (result.length % 7 !== 0) result.push({ date: null, iso: null });
    return result;
  }, [year, month]);

  const weeks = useMemo(() => {
    const rows: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cells]);

  const yearOptions = useMemo(() => {
    const base = now.getFullYear();
    return Array.from({ length: 11 }, (_, i) => base - 5 + i);
  }, [now]);

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const openCreate = (iso?: string) => {
    setEditing(null);
    setError(null);
    const base = iso ? parseISODate(iso) : new Date(year, month, Math.min(now.getDate(), daysInMonth(year, month)));
    const start = toISODate(base);
    const end = toISODate(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 6));
    setForm({ name: '', startDate: start, endDate: end, notes: '', media: [] });
    setModalOpen(true);
  };

  const openEdit = (campaign: LocalCampaign) => {
    setEditing(campaign);
    setError(null);
    setForm({
      name: campaign.name,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      notes: campaign.notes,
      media: campaign.media,
    });
    setModalOpen(true);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setUploading(true);
    setError(null);
    try {
      const incoming = Array.from(fileList);
      const next: DraftMedia[] = [...form.media];
      for (const file of incoming) {
        if (next.length >= MAX_MEDIA) break;
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          setError(`"${file.name}" supera ${MAX_FILE_MB} MB (límite del boceto local).`);
          continue;
        }
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
          setError(`"${file.name}" no es imagen ni audiovisual.`);
          continue;
        }
        const dataUrl = await fileToDataUrl(file);
        next.push({
          id: crypto.randomUUID(),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          dataUrl,
        });
      }
      setForm((f) => ({ ...f, media: next }));
    } catch {
      setError('No se pudieron leer uno o más archivos.');
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (id: string) => {
    setForm((f) => ({ ...f, media: f.media.filter((m) => m.id !== id) }));
  };

  const handleSave = () => {
    setError(null);
    const name = form.name.trim();
    if (!name) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError('Indica fecha de inicio y fin.');
      return;
    }
    if (form.startDate > form.endDate) {
      setError('La fecha de inicio no puede ser posterior a la de fin.');
      return;
    }

    if (editing) {
      updateCampaign(editing.id, {
        name,
        startDate: form.startDate,
        endDate: form.endDate,
        notes: form.notes.trim(),
        media: form.media,
      });
    } else {
      addCampaign({
        name,
        startDate: form.startDate,
        endDate: form.endDate,
        notes: form.notes.trim(),
        media: form.media,
        color: nextCampaignColor(campaigns),
      });
    }
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (!editing) return;
    if (!window.confirm(`¿Eliminar la campaña "${editing.name}"?`)) return;
    removeCampaign(editing.id);
    setModalOpen(false);
  };

  const todayIso = toISODate(now);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Megaphone className="text-accent" size={26} />
            Campañas
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Calendario local de boceto — los datos se guardan solo en este navegador.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <Plus size={16} />
          Nueva campaña
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-slate-50/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              className="p-2 rounded-md border border-border bg-white text-slate-600 hover:border-accent hover:text-accent"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="p-2 rounded-md border border-border bg-white text-slate-600 hover:border-accent hover:text-accent"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={18} />
            </button>
            <div className="flex items-center gap-2 ml-1">
              <CalendarDays size={16} className="text-slate-400" />
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="text-sm font-semibold text-primary bg-white border border-border rounded-md px-2 py-1.5"
              >
                {MONTHS.map((label, idx) => (
                  <option key={label} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="text-sm font-semibold text-primary bg-white border border-border rounded-md px-2 py-1.5"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setYear(now.getFullYear());
              setMonth(now.getMonth());
            }}
            className="text-xs font-medium text-accent hover:underline"
          >
            Ir a hoy
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-white">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-r border-border last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="divide-y divide-border">
          {weeks.map((week, wi) => {
            const weekStart = week.find((c) => c.iso)?.iso ?? monthStartIso;
            const weekEnd = [...week].reverse().find((c) => c.iso)?.iso ?? monthEndIso;
            const weekCampaigns = monthCampaigns.filter((c) =>
              rangesOverlap(c.startDate, c.endDate, weekStart, weekEnd),
            );

            return (
              <div key={wi} className="relative">
                <div className="grid grid-cols-7 min-h-[120px]">
                  {week.map((cell, di) => {
                    const isToday = cell.iso === todayIso;
                    const inMonth = Boolean(cell.date);
                    return (
                      <button
                        key={di}
                        type="button"
                        disabled={!inMonth}
                        onClick={() => cell.iso && openCreate(cell.iso)}
                        className={`relative border-r border-border last:border-r-0 min-h-[120px] p-1.5 text-left align-top transition-colors ${
                          inMonth ? 'bg-white hover:bg-accent/5 cursor-pointer' : 'bg-slate-50/80 cursor-default'
                        }`}
                      >
                        {cell.date && (
                          <span
                            className={`absolute top-1.5 left-1.5 z-10 text-xs leading-none tabular-nums ${
                              isToday
                                ? 'font-semibold text-accent'
                                : 'font-medium text-slate-500'
                            }`}
                          >
                            {cell.date.getDate()}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {weekCampaigns.length > 0 && (
                  <div className="absolute left-0 right-0 top-7 px-1 space-y-1 pointer-events-none">
                    {weekCampaigns.slice(0, 3).map((c) => {
                      const firstIdx = week.findIndex(
                        (cell) => cell.iso && cell.iso >= c.startDate && cell.iso <= c.endDate,
                      );
                      const lastIdx = (() => {
                        let idx = -1;
                        week.forEach((cell, i) => {
                          if (cell.iso && cell.iso >= c.startDate && cell.iso <= c.endDate) idx = i;
                        });
                        return idx;
                      })();
                      if (firstIdx < 0 || lastIdx < 0) return null;
                      const span = lastIdx - firstIdx + 1;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(c);
                          }}
                          className="pointer-events-auto h-6 rounded-md px-2 text-[11px] font-semibold text-white truncate shadow-sm hover:brightness-110 transition"
                          style={{
                            marginLeft: `calc(${(firstIdx / 7) * 100}% + 2px)`,
                            width: `calc(${(span / 7) * 100}% - 4px)`,
                            backgroundColor: c.color,
                          }}
                          title={`${c.name} (${formatDate(c.startDate)} → ${formatDate(c.endDate)})`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                    {weekCampaigns.length > 3 && (
                      <div className="text-[10px] text-slate-500 px-2">+{weekCampaigns.length - 3} más</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-primary mb-3">
          Campañas en {MONTHS[month]} {year}
          {!hydrated && <span className="text-slate-400 font-normal"> · cargando…</span>}
        </h2>
        {monthCampaigns.length === 0 ? (
          <p className="text-sm text-slate-400">No hay campañas en este mes. Crea una para verla en el calendario.</p>
        ) : (
          <ul className="space-y-2">
            {monthCampaigns.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:border-accent/40 hover:bg-slate-50 text-left transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-primary truncate">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(c.startDate)} → {formatDate(c.endDate)}
                      {c.media.length > 0 && ` · ${c.media.length} archivo${c.media.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar campaña' : 'Nueva campaña'}
        description="Boceto local: nombre, fechas y archivos audiovisuales. No se sube a servidor."
        size="lg"
        footer={
          <>
            {editing && (
              <button
                type="button"
                onClick={handleDelete}
                className="sm:mr-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
              >
                <Trash2 size={15} />
                Eliminar
              </button>
            )}
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-border text-slate-600 hover:bg-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={uploading}
              className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50"
            >
              {editing ? 'Guardar cambios' : 'Crear campaña'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Nombre
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej.: Lanzamiento verano ES"
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Inicio
              </label>
              <DateInput
                value={form.startDate}
                onChange={(startDate) => setForm((f) => ({ ...f, startDate }))}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Fin
              </label>
              <DateInput
                value={form.endDate}
                onChange={(endDate) => setForm((f) => ({ ...f, endDate }))}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Notas
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Opcional"
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-y"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Imágenes / audiovisual
              </label>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-medium text-slate-600 hover:border-accent hover:text-accent cursor-pointer">
                <Upload size={14} />
                {uploading ? 'Cargando…' : 'Añadir archivos'}
                <input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  multiple
                  className="hidden"
                  disabled={uploading || form.media.length >= MAX_MEDIA}
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-400">
              Hasta {MAX_MEDIA} archivos · máx. {MAX_FILE_MB} MB c/u · se guardan en este navegador
            </p>

            {form.media.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {form.media.map((m) => (
                  <div
                    key={m.id}
                    className="relative rounded-lg border border-border overflow-hidden bg-slate-50 aspect-video"
                  >
                    {isMediaImage(m.mimeType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.dataUrl} alt={m.name} className="w-full h-full object-cover" />
                    ) : isMediaVideo(m.mimeType) ? (
                      <video src={m.dataUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400">
                        <Film size={20} />
                        <span className="text-[10px] px-2 text-center truncate w-full">{m.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(m.id)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
                      title="Quitar"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1.5 py-0.5 truncate flex items-center gap-1">
                      {isMediaImage(m.mimeType) ? <ImageIcon size={10} /> : <Film size={10} />}
                      {m.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

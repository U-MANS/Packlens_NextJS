import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Info,
  Megaphone,
  Paperclip,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DateInput } from '../components/ui/DateInput';
import { useAppStore } from '../store/useAppStore';
import type { Campaign, CampaignFormat } from '../types';

// ─── Datos ─────────────────────────────────────────────────────────────────

const FORMAT_GROUPS: { label: string; formats: CampaignFormat[] }[] = [
  {
    label: 'Display',
    formats: [
      'Banner estático/animado',
      'Banner expandible/interactivo',
      'Rich Media/Video Banners',
      'Formatos flotantes/Interstitials',
    ],
  },
  {
    label: 'Audiovisual',
    formats: ['Spot Publicitario', 'Motion Graphics', 'Videos Corporativos'],
  },
  {
    label: 'Contenido',
    formats: [
      'Branded Content',
      'Contenido para Redes Sociales',
      'Creatividad',
      'Lineal',
    ],
  },
];

const OWNERS = [
  'Ana García (Marketing)',
  'Carlos Ruiz (Marketing)',
  'Marta Díaz (Marketing)',
  'Jorge López (Marketing)',
];

const DESIGN_LEADS = [
  'Alex C. WeWork',
  'Laura Vega (Diseño)',
  'Pablo Mora (Diseño)',
  'Sofía Ramos (Diseño)',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2 bg-white border border-border rounded-md text-sm text-primary placeholder:text-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all';

const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </span>
    {children}
    {hint && <span className="block text-xs text-slate-400 mt-1.5">{hint}</span>}
  </label>
);

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
      active
        ? 'bg-purple-600 text-white border-purple-600'
        : 'bg-white text-slate-700 border-slate-200 hover:border-purple-400/50 hover:bg-purple-50/50'
    }`}
  >
    {active && <CheckCircle2 size={14} />}
    {children}
  </button>
);

// ─── Form state ─────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  projectId: string;
  formats: CampaignFormat[];
  owner: string;
  designLead: string;
  launchDate: string;
  artDeadline: string;
  description: string;
  briefingNotes: string;
  briefingFileName: string;
  briefingFileSizeKb?: number;
}

const INITIAL: FormState = {
  name: '',
  projectId: '',
  formats: [],
  owner: '',
  designLead: '',
  launchDate: '',
  artDeadline: '',
  description: '',
  briefingNotes: '',
  briefingFileName: '',
  briefingFileSizeKb: undefined,
};

// ─── Component ───────────────────────────────────────────────────────────────

const NewCampaign = () => {
  const navigate = useNavigate();
  const { projects, addCampaign, activeRole } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleFormat = (f: CampaignFormat) =>
    setForm((prev) => ({
      ...prev,
      formats: prev.formats.includes(f)
        ? prev.formats.filter((x) => x !== f)
        : [...prev.formats, f],
    }));

  const selectedProject = projects.find((p) => p.id === form.projectId);

  const onFileChosen = (file?: File) => {
    if (!file) return;
    update('briefingFileName', file.name);
    update('briefingFileSizeKb', Math.max(1, Math.round(file.size / 1024)));
  };

  const removeFile = () => {
    update('briefingFileName', '');
    update('briefingFileSizeKb', undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState | 'formats', string>> = {};
    if (!form.name.trim()) e.name = 'Nombre de campaña obligatorio';
    if (!form.projectId) e.projectId = 'Selecciona un producto';
    if (form.formats.length === 0) e.formats = 'Selecciona al menos un formato';
    if (!form.owner) e.owner = 'Asigna un responsable';
    if (!form.launchDate) e.launchDate = 'Fecha de lanzamiento requerida';
    if (
      form.launchDate &&
      form.artDeadline &&
      new Date(form.artDeadline) > new Date(form.launchDate)
    ) {
      e.artDeadline = 'La fecha límite de arte debe ser anterior al lanzamiento';
    }
    return e;
  }, [form]);

  const isValid = Object.keys(errors).length === 0;

  const handleSubmit = (asDraft: boolean) => {
    setSubmitAttempted(true);
    if (!asDraft && !isValid) return;

    const now = new Date().toISOString();
    const id = `c-${Date.now()}`;

    const campaign: Campaign = {
      id,
      name: form.name.trim(),
      projectId: form.projectId,
      productName: selectedProject?.name ?? '—',
      productSku: selectedProject?.sku ?? '—',
      formats: form.formats,
      owner: form.owner || activeRole,
      designLead: form.designLead || undefined,
      launchDate: form.launchDate,
      artDeadline: form.artDeadline || undefined,
      description: form.description.trim(),
      briefingNotes: form.briefingNotes || undefined,
      briefingFileName: form.briefingFileName || undefined,
      briefingFileSizeKb: form.briefingFileSizeKb,
      status: asDraft ? 'Borrador' : 'En producción',
      createdAt: now,
      archived: false,
    };

    addCampaign(campaign);
    navigate(`/campaigns/${campaign.id}`);
  };

  const summary = useMemo(
    () => [
      { label: 'Nombre', value: form.name || '—' },
      { label: 'Producto', value: selectedProject?.name ?? '—' },
      { label: 'Cód. artículo', value: selectedProject?.sku ?? '—', mono: true },
      {
        label: 'Formatos',
        value: form.formats.length ? `${form.formats.length} seleccionados` : '—',
      },
      { label: 'Responsable', value: form.owner || '—' },
      { label: 'Resp. diseño', value: form.designLead || '—' },
      { label: 'Lanzamiento', value: form.launchDate || '—' },
      { label: 'Límite arte', value: form.artDeadline || '—' },
    ],
    [form, selectedProject],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header */}
      <div className="bg-surface border-b border-border px-8 pt-6 pb-5 shrink-0">
        <button
          onClick={() => navigate('/campaigns')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-3"
        >
          <ArrowLeft size={16} /> Volver a campañas
        </button>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                <Megaphone size={18} />
              </div>
              <h1 className="text-2xl font-bold text-primary">Nueva campaña</h1>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                <Sparkles size={12} /> Entrada de campaña
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Asocia la campaña a un producto existente, define su formato creativo, equipo y fechas
              clave.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">
          <div className="space-y-6">

            {/* ── Información del producto ── */}
            <Card>
              <CardHeader>
                <CardTitle>Información del producto</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Selecciona el producto de packaging al que pertenece esta campaña.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="Nombre de la campaña" required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="Ej. Campaña verano Mermelada Fresa 2026"
                    className={inputClass}
                  />
                  {submitAttempted && errors.name && (
                    <span className="text-xs text-red-500 mt-1 block">{errors.name}</span>
                  )}
                </Field>

                <Field
                  label="Producto vinculado"
                  required
                  hint="El producto debe existir como proyecto de packaging en el sistema."
                >
                  <select
                    value={form.projectId}
                    onChange={(e) => update('projectId', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecciona un producto…</option>
                    {projects
                      .filter((p) => !p.archived)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.sku}
                          {p.productLine ? ` (${p.productLine})` : ''}
                        </option>
                      ))}
                  </select>
                  {submitAttempted && errors.projectId && (
                    <span className="text-xs text-red-500 mt-1 block">{errors.projectId}</span>
                  )}

                  {/* Product preview card */}
                  {selectedProject && (
                    <div className="mt-3 flex items-center gap-3 p-3 bg-slate-50 border border-border rounded-lg">
                      <div className="w-10 h-10 rounded-md bg-accent/10 text-accent flex items-center justify-center font-bold text-xs shrink-0">
                        {selectedProject.sku.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">
                          {selectedProject.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {selectedProject.productLine ?? ''}
                          {selectedProject.productLine && selectedProject.format ? ' · ' : ''}
                          {selectedProject.format ?? ''}
                          {selectedProject.markets?.length
                            ? ` · ${selectedProject.markets.join(', ')}`
                            : ''}
                        </p>
                      </div>
                      <span
                        className={`ml-auto shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          selectedProject.phase === 'Aprobación final' || selectedProject.phase === 'Aprobado'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {selectedProject.phase}
                      </span>
                    </div>
                  )}
                </Field>
              </CardContent>
            </Card>

            {/* ── Formato de campaña ── */}
            <Card>
              <CardHeader>
                <CardTitle>Formato de campaña</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Selecciona los formatos creativos que se producirán en esta campaña.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {FORMAT_GROUPS.map((group) => (
                  <div key={group.label}>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                      {group.label}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {group.formats.map((f) => (
                        <Chip
                          key={f}
                          active={form.formats.includes(f)}
                          onClick={() => toggleFormat(f)}
                        >
                          {f}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
                {submitAttempted && errors.formats && (
                  <span className="text-xs text-red-500 block">{errors.formats}</span>
                )}
              </CardContent>
            </Card>

            {/* ── Fechas y equipo ── */}
            <Card>
              <CardHeader>
                <CardTitle>Fechas y equipo</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Hitos clave y personas responsables de la campaña.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Fecha de lanzamiento" required>
                    <DateInput
                      value={form.launchDate}
                      onChange={(v) => update('launchDate', v)}
                      className={inputClass}
                    />
                    {submitAttempted && errors.launchDate && (
                      <span className="text-xs text-red-500 mt-1 block">{errors.launchDate}</span>
                    )}
                  </Field>

                  <Field
                    label="Fecha límite de arte"
                    hint="Debe ser anterior al lanzamiento."
                  >
                    <DateInput
                      value={form.artDeadline}
                      onChange={(v) => update('artDeadline', v)}
                      className={inputClass}
                    />
                    {submitAttempted && errors.artDeadline && (
                      <span className="text-xs text-red-500 mt-1 block">{errors.artDeadline}</span>
                    )}
                  </Field>

                  <Field label="Responsable (Marketing)" required>
                    <select
                      value={form.owner}
                      onChange={(e) => update('owner', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Selecciona responsable…</option>
                      {OWNERS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    {submitAttempted && errors.owner && (
                      <span className="text-xs text-red-500 mt-1 block">{errors.owner}</span>
                    )}
                  </Field>

                  <Field
                    label="Responsable de diseño"
                    hint="Persona que liderará la producción creativa."
                  >
                    <select
                      value={form.designLead}
                      onChange={(e) => update('designLead', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Sin asignar</option>
                      {DESIGN_LEADS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* ── Briefing ── */}
            <Card>
              <CardHeader>
                <CardTitle>Briefing creativo</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Adjunta el briefing y resume los puntos clave para el equipo creativo.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="Descripción breve">
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                    placeholder="Objetivo de la campaña, mensaje principal, tono y estilo…"
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Briefing adjunto
                  </span>
                  {!form.briefingFileName ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-lg py-8 px-4 text-sm text-slate-500 hover:border-purple-400 hover:bg-purple-50/30 transition-colors"
                    >
                      <Upload size={20} className="text-slate-400" />
                      <span>
                        <span className="text-purple-600 font-medium">Haz clic para subir</span> o
                        arrastra un PDF
                      </span>
                      <span className="text-xs text-slate-400">PDF, AI, PNG · hasta 25 MB</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-border rounded-lg">
                      <div className="w-10 h-10 rounded-md bg-red-50 text-red-600 flex items-center justify-center font-semibold text-xs">
                        PDF
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">
                          {form.briefingFileName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {form.briefingFileSizeKb
                            ? `${form.briefingFileSizeKb.toLocaleString()} KB`
                            : 'Subido'}
                          <span className="mx-1.5">·</span>
                          <span className="text-emerald-600">Listo</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="Eliminar archivo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.ai,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => onFileChosen(e.target.files?.[0])}
                  />
                </div>

                <Field
                  label="Notas del briefing"
                  hint="Visible en la cabecera de la campaña y en la actividad inicial."
                >
                  <textarea
                    rows={3}
                    value={form.briefingNotes}
                    onChange={(e) => update('briefingNotes', e.target.value)}
                    placeholder="Claim principal, paleta cromática, referencias visuales, requisitos legales…"
                    className={`${inputClass} resize-none`}
                  />
                </Field>
              </CardContent>
            </Card>

            {/* ── Actions ── */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/campaigns')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-border bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
              >
                <X size={16} /> Cancelar
              </button>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-border bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  Guardar borrador
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={submitAttempted && !isValid}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={16} /> Crear campaña y notificar equipo
                </button>
              </div>
            </div>

            {submitAttempted && !isValid && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                <Info size={16} className="mt-0.5 shrink-0" />
                <span>Revisa los campos marcados antes de continuar.</span>
              </div>
            )}
          </div>

          {/* ── Side summary ── */}
          <aside className="space-y-6 xl:sticky xl:top-6 self-start">
            <Card className="bg-gradient-to-br from-purple-50/60 to-white">
              <CardHeader className="border-b-0 pb-2">
                <CardTitle className="text-base">Vista previa</CardTitle>
                <p className="text-xs text-slate-500 mt-1">Así quedará la campaña al crearse.</p>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {summary.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-3 text-sm border-b border-border/60 last:border-b-0 pb-2 last:pb-0"
                  >
                    <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold shrink-0">
                      {row.label}
                    </span>
                    <span
                      className={`text-right text-primary font-medium ${
                        row.mono ? 'font-mono text-xs' : ''
                      }`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {form.formats.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Formatos seleccionados</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex flex-wrap gap-1.5">
                  {form.formats.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium"
                    >
                      {f}
                    </span>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip size={16} className="text-slate-400" />
                  Adjuntos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {form.briefingFileName ? (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <FileText size={16} className="text-slate-400" />
                    <span className="truncate">{form.briefingFileName}</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Aún no has adjuntado un briefing.</p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default NewCampaign;

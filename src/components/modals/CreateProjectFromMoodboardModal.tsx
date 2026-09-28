'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, FileImage, Loader2 } from 'lucide-react';

import { Modal } from '../ui/Modal';
import { DateInput } from '../ui/DateInput';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { toast } from '../ui/Toast';
import { getErrorMessage } from '../../utils/errors';
import { ensureUniqueSku, isSkuTaken, slugSkuFromName } from '../../utils/sku';
import { loadArrayBufferFromUrl } from '../../utils/files';
import {
  availableLanguages,
  availableMarkets,
  productLines,
} from '../../data/mockSeed';
import type { FlowType } from '../../types';

export type MoodboardProposalSource = {
  id: string;
  label: string;
  url: string;
  storage_key: string | null;
  revised_prompt: string | null;
};

type Props = {
  open: boolean;
  proposal: MoodboardProposalSource | null;
  creativeBrief?: string | null;
  onClose: () => void;
};

const formatOptions = [
  'Tarro vidrio 340g',
  'Tarro vidrio 640g',
  'Tarro vidrio 250g',
  'Tarro Hex 300g',
  'Bote 350g',
  'Pack surtidos 8x25g',
  'Lata 825g',
];

const FLOW_OPTIONS: { value: FlowType; locked: boolean }[] = [
  { value: 'Nacional', locked: false },
  { value: 'Exportación', locked: true },
  { value: 'Marca Blanca', locked: true },
  { value: 'Campaña audiovisual', locked: false },
];

const inputClass =
  'w-full px-3 py-2 bg-white border border-border rounded-md text-sm text-primary placeholder:text-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all';

type FormState = {
  name: string;
  sku: string;
  flowType: FlowType;
  productLine: string;
  format: string;
  markets: string[];
  labelLanguagesFront: string[];
  labelLanguagesBack: string[];
  labelLanguages: string[];
  launchDate: string;
  artDeadline: string;
  description: string;
  briefingNotes: string;
};

function buildNotes(proposal: MoodboardProposalSource, creativeBrief?: string | null): string {
  const parts: string[] = [];
  parts.push(`Moodboard: ${proposal.label}`);
  if (creativeBrief?.trim()) parts.push(`Brief creativo:\n${creativeBrief.trim()}`);
  if (proposal.revised_prompt?.trim()) {
    parts.push(`Prompt revisado de la propuesta:\n${proposal.revised_prompt.trim()}`);
  }
  parts.push('La imagen generada en Moodboard se adjunta como archivo de briefing / referencia visual.');
  return parts.join('\n\n');
}

async function proposalImageToFile(proposal: MoodboardProposalSource): Promise<File> {
  let buffer: ArrayBuffer;
  try {
    buffer = await loadArrayBufferFromUrl(proposal.url);
  } catch {
    if (proposal.storage_key) {
      buffer = await loadArrayBufferFromUrl(
        `/api/v1/files/${proposal.storage_key}?filename=${encodeURIComponent(`${proposal.label}.png`)}`,
      );
    } else {
      throw new Error('No se pudo descargar la imagen de la propuesta');
    }
  }
  const fileName = `${proposal.label.replace(/[^\w.\-]+/g, '_').toLowerCase() || 'moodboard'}.png`;
  return new File([buffer], fileName, { type: 'image/png' });
}

const Field: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, error, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </span>
    {children}
    {error && <span className="block text-xs text-red-500 mt-1">{error}</span>}
  </label>
);

const Chip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ active, onClick, children, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors disabled:opacity-50 ${
      active
        ? 'bg-accent text-white border-accent'
        : 'bg-white text-slate-700 border-slate-200 hover:border-accent/40 hover:bg-accent/5'
    }`}
  >
    {active && <CheckCircle2 size={12} />}
    {children}
  </button>
);

export const CreateProjectFromMoodboardModal: React.FC<Props> = ({
  open,
  proposal,
  creativeBrief,
  onClose,
}) => {
  const navigate = useNavigate();
  const projects = useAppStore((s) => s.projects);
  const addProject = useAppStore((s) => s.addProject);
  const uploadProjectThumbnail = useAppStore((s) => s.uploadProjectThumbnail);
  const authUser = useAuthStore((s) => s.user);

  const [form, setForm] = useState<FormState | null>(null);
  const [skuTouched, setSkuTouched] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !proposal) {
      setForm(null);
      setImageFile(null);
      setImagePreview(null);
      setSkuTouched(false);
      setSubmitAttempted(false);
      setSubmitting(false);
      setError(null);
      setLoadingImage(false);
      return;
    }

    setForm({
      name: '',
      sku: '',
      flowType: 'Nacional',
      productLine: '',
      format: '',
      markets: ['ES'],
      labelLanguagesFront: ['Español'],
      labelLanguagesBack: ['Español'],
      labelLanguages: ['Español'],
      launchDate: '',
      artDeadline: '',
      description: '',
      briefingNotes: buildNotes(proposal, creativeBrief),
    });
    setSkuTouched(false);
    setSubmitAttempted(false);
    setError(null);

    let cancelled = false;
    let previewUrl: string | null = null;
    setLoadingImage(true);
    void (async () => {
      try {
        const file = await proposalImageToFile(proposal);
        if (cancelled) return;
        previewUrl = URL.createObjectURL(file);
        setImageFile(file);
        setImagePreview(previewUrl);
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'No se pudo cargar la imagen de la propuesta'));
        }
      } finally {
        if (!cancelled) setLoadingImage(false);
      }
    })();

    return () => {
      cancelled = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // Solo al abrir / cambiar propuesta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proposal?.id]);

  const isAvFlow = form?.flowType === 'Campaña audiovisual';

  const takenSkus = useMemo(
    () => projects.filter((p) => !p.archived).map((p) => p.sku),
    [projects],
  );

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form) return e;
    if (!form.name.trim()) e.name = isAvFlow ? 'Nombre de campaña obligatorio' : 'Nombre obligatorio';
    if (!form.sku.trim()) {
      e.sku = isAvFlow ? 'Código de campaña obligatorio' : 'Código de artículo obligatorio';
    } else if (isSkuTaken(form.sku, projects)) {
      e.sku = `El código «${form.sku.trim()}» ya está en uso.`;
    }
    if (form.markets.length === 0) e.markets = 'Selecciona al menos un mercado';
    if (!isAvFlow) {
      if (form.labelLanguagesFront.length === 0) {
        e.labelLanguagesFront = 'Selecciona al menos un idioma frontal';
      }
      if (form.labelLanguagesBack.length === 0) {
        e.labelLanguagesBack = 'Selecciona al menos un idioma trasero';
      }
    } else if (form.labelLanguages.length === 0) {
      e.labelLanguages = 'Selecciona al menos un idioma';
    }
    if (!form.launchDate) e.launchDate = 'Fecha de lanzamiento requerida';
    if (!form.artDeadline) e.artDeadline = 'Fecha límite de arte requerida';
    if (
      form.launchDate &&
      form.artDeadline &&
      new Date(form.artDeadline) > new Date(form.launchDate)
    ) {
      e.artDeadline = 'La fecha límite de arte debe ser anterior al lanzamiento';
    }
    return e;
  }, [form, isAvFlow, projects]);

  const isValid = Object.keys(errors).length === 0 && Boolean(imageFile);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const onNameChange = (name: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, name };
      if (!skuTouched) {
        const base = slugSkuFromName(name);
        next.sku = base ? ensureUniqueSku(base, takenSkus) : '';
      }
      return next;
    });
  };

  const toggleMarket = (code: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const markets = prev.markets.includes(code)
        ? prev.markets.filter((m) => m !== code)
        : [...prev.markets, code];
      return { ...prev, markets };
    });
  };

  const toggleLang = (
    key: 'labelLanguages' | 'labelLanguagesFront' | 'labelLanguagesBack',
    lang: string,
  ) => {
    setForm((prev) => {
      if (!prev) return prev;
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(lang) ? list.filter((l) => l !== lang) : [...list, lang],
      };
    });
  };

  const handleSubmit = async () => {
    if (!form || !proposal) return;
    setSubmitAttempted(true);
    if (!isValid || !imageFile) {
      setError(
        !imageFile
          ? 'La imagen de la propuesta no está lista.'
          : 'Completa los campos obligatorios.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const projectId = await addProject(
        {
          name: form.name.trim(),
          sku: form.sku.trim(),
          flow_type: form.flowType,
          product_line: isAvFlow ? undefined : form.productLine || undefined,
          format: isAvFlow ? undefined : form.format || undefined,
          markets: form.markets,
          label_languages: isAvFlow
            ? form.labelLanguages
            : [...new Set([...form.labelLanguagesFront, ...form.labelLanguagesBack])],
          label_languages_front: isAvFlow ? [] : form.labelLanguagesFront,
          label_languages_back: isAvFlow ? [] : form.labelLanguagesBack,
          launch_date: form.launchDate || undefined,
          art_deadline: form.artDeadline || undefined,
          owner_name: authUser?.name,
          description: form.description.trim() || undefined,
          briefing_notes: form.briefingNotes.trim() || undefined,
        },
        [imageFile],
      );

      try {
        await uploadProjectThumbnail(projectId, imageFile);
      } catch {
        /* briefing ya subido; thumbnail es opcional */
      }

      onClose();
      navigate(`/projects/${projectId}`);
    } catch (err) {
      const msg = getErrorMessage(err, 'Error al crear el proyecto');
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!proposal) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crear briefing desde Moodboard"
      description="Completa los datos del proyecto. La imagen seleccionada se adjuntará al briefing."
      size="xl"
      preventClose={submitting}
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting || loadingImage || !imageFile}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileImage size={16} />}
            {submitting ? 'Creando proyecto…' : 'Crear proyecto'}
          </button>
        </>
      }
    >
      {!form ? (
        <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
          <Loader2 size={18} className="animate-spin mr-2" />
          Preparando formulario…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Imagen de briefing
            </p>
            <div className="aspect-square rounded-lg border border-border overflow-hidden bg-slate-50">
              {loadingImage ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt={proposal.label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 p-3 text-center">
                  No se pudo cargar la imagen
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">{proposal.label}</p>
          </div>

          <div className="space-y-4 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre" required error={submitAttempted ? errors.name : undefined}>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Ej. Mermelada de Fresa Helios 340g"
                  disabled={submitting}
                />
              </Field>
              <Field
                label={isAvFlow ? 'Código de campaña' : 'Código de artículo'}
                required
                error={submitAttempted ? errors.sku : undefined}
              >
                <input
                  className={`${inputClass} font-mono`}
                  value={form.sku}
                  onChange={(e) => {
                    setSkuTouched(true);
                    update('sku', e.target.value.toUpperCase());
                  }}
                  placeholder="SKU-AUTO"
                  disabled={submitting}
                />
              </Field>
            </div>

            <Field label="Tipo de flujo" required>
              <div className="flex flex-wrap gap-2">
                {FLOW_OPTIONS.map(({ value, locked }) => (
                  <Chip
                    key={value}
                    active={form.flowType === value}
                    disabled={locked || submitting}
                    onClick={() => !locked && update('flowType', value)}
                  >
                    {value}
                    {locked ? ' · pronto' : ''}
                  </Chip>
                ))}
              </div>
            </Field>

            {!isAvFlow && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Línea de producto">
                  <select
                    className={inputClass}
                    value={form.productLine}
                    onChange={(e) => update('productLine', e.target.value)}
                    disabled={submitting}
                  >
                    <option value="">Seleccionar…</option>
                    {productLines.map((pl) => (
                      <option key={pl} value={pl}>
                        {pl}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Formato">
                  <select
                    className={inputClass}
                    value={form.format}
                    onChange={(e) => update('format', e.target.value)}
                    disabled={submitting}
                  >
                    <option value="">Seleccionar…</option>
                    {formatOptions.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <Field label="Mercados" required error={submitAttempted ? errors.markets : undefined}>
              <div className="flex flex-wrap gap-2">
                {availableMarkets.map((m) => (
                  <Chip
                    key={m.code}
                    active={form.markets.includes(m.code)}
                    disabled={submitting}
                    onClick={() => toggleMarket(m.code)}
                  >
                    {m.label}
                  </Chip>
                ))}
              </div>
            </Field>

            {isAvFlow ? (
              <Field
                label="Idiomas"
                required
                error={submitAttempted ? errors.labelLanguages : undefined}
              >
                <div className="flex flex-wrap gap-2">
                  {availableLanguages.map((lang) => (
                    <Chip
                      key={lang}
                      active={form.labelLanguages.includes(lang)}
                      disabled={submitting}
                      onClick={() => toggleLang('labelLanguages', lang)}
                    >
                      {lang}
                    </Chip>
                  ))}
                </div>
              </Field>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Idiomas frontal"
                  required
                  error={submitAttempted ? errors.labelLanguagesFront : undefined}
                >
                  <div className="flex flex-wrap gap-2">
                    {availableLanguages.map((lang) => (
                      <Chip
                        key={lang}
                        active={form.labelLanguagesFront.includes(lang)}
                        disabled={submitting}
                        onClick={() => toggleLang('labelLanguagesFront', lang)}
                      >
                        {lang}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field
                  label="Idiomas trasero"
                  required
                  error={submitAttempted ? errors.labelLanguagesBack : undefined}
                >
                  <div className="flex flex-wrap gap-2">
                    {availableLanguages.map((lang) => (
                      <Chip
                        key={lang}
                        active={form.labelLanguagesBack.includes(lang)}
                        disabled={submitting}
                        onClick={() => toggleLang('labelLanguagesBack', lang)}
                      >
                        {lang}
                      </Chip>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Fecha límite de arte"
                required
                error={submitAttempted ? errors.artDeadline : undefined}
              >
                <DateInput
                  value={form.artDeadline}
                  onChange={(v) => update('artDeadline', v)}
                  disabled={submitting}
                />
              </Field>
              <Field
                label="Fecha de lanzamiento"
                required
                error={submitAttempted ? errors.launchDate : undefined}
              >
                <DateInput
                  value={form.launchDate}
                  onChange={(v) => update('launchDate', v)}
                  disabled={submitting}
                />
              </Field>
            </div>

            <Field label="Descripción">
              <textarea
                className={`${inputClass} resize-y min-h-[64px]`}
                rows={2}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Contexto breve del producto o campaña"
                disabled={submitting}
              />
            </Field>

            <Field label="Notas de briefing">
              <textarea
                className={`${inputClass} resize-y min-h-[100px]`}
                rows={4}
                value={form.briefingNotes}
                onChange={(e) => update('briefingNotes', e.target.value)}
                disabled={submitting}
              />
            </Field>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

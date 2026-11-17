'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { Download, FileArchive, FileJson, Loader2, Upload } from 'lucide-react';

import { createDemoProject } from '../../api';
import demoTemplateJson from '../../data/demo-project.template.json';
import { Modal } from '../ui/Modal';
import { toast } from '../ui/Toast';
import { getErrorMessage } from '../../utils/errors';
import { useAppStore } from '../../store/useAppStore';

type DemoTemplatePreview = {
  project?: {
    name?: string;
    sku?: string;
    phase?: string;
    status?: string;
    product_line?: string;
    format?: string;
    markets?: string[];
    flow_type?: string;
  };
  proposals?: Array<{
    name?: string;
    files?: string[];
    [key: string]: unknown;
  }>;
  phase_actions?: unknown[];
  activity?: unknown[];
  tasks?: unknown[];
  comments?: unknown[];
  time_entries?: unknown[];
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateDemoTemplate(
  value: unknown,
): { ok: true; data: DemoTemplatePreview } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: 'El JSON debe ser un objeto.' };
  }
  if (!isRecord(value.project)) {
    return { ok: false, error: 'Falta el bloque "project".' };
  }
  const project = value.project;
  if (typeof project.name !== 'string' || !project.name.trim()) {
    return { ok: false, error: 'project.name es obligatorio.' };
  }
  if (typeof project.sku !== 'string' || !project.sku.trim()) {
    return { ok: false, error: 'project.sku es obligatorio.' };
  }
  if (typeof project.phase !== 'string' || !project.phase.trim()) {
    return { ok: false, error: 'project.phase es obligatorio.' };
  }

  const arrayKeys = [
    'proposals',
    'phase_actions',
    'activity',
    'tasks',
    'comments',
    'time_entries',
  ] as const;
  for (const key of arrayKeys) {
    if (value[key] !== undefined && !Array.isArray(value[key])) {
      return { ok: false, error: `"${key}" debe ser un array si está presente.` };
    }
  }

  return { ok: true, data: value as DemoTemplatePreview };
}

function normalizeZipPath(raw: string): string {
  return raw.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+/g, '/');
}

function collectReferencedFiles(template: DemoTemplatePreview): string[] {
  const refs = new Set<string>();
  for (const proposal of template.proposals ?? []) {
    for (const file of proposal.files ?? []) {
      if (typeof file === 'string' && file.trim()) refs.add(normalizeZipPath(file));
    }
  }
  return [...refs];
}

function downloadTemplate() {
  const blob = new Blob([JSON.stringify(demoTemplateJson, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'demo-project.template.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DemoProjectModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const bootstrap = useAppStore((s) => s.bootstrap);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [template, setTemplate] = useState<DemoTemplatePreview | null>(null);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [zipEntries, setZipEntries] = useState<string[]>([]);
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uniqueSku, setUniqueSku] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFileName(null);
      setTemplate(null);
      setArchiveFile(null);
      setZipEntries([]);
      setMissingFiles([]);
      setParseError(null);
      setUniqueSku(true);
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  const applyParsed = (
    raw: unknown,
    name: string,
    options?: { archive?: File | null; entries?: string[] },
  ) => {
    const result = validateDemoTemplate(raw);
    if (!result.ok) {
      setTemplate(null);
      setFileName(null);
      setArchiveFile(null);
      setZipEntries([]);
      setMissingFiles([]);
      setParseError(result.error);
      return;
    }

    const refs = collectReferencedFiles(result.data);
    const entries = options?.entries ?? [];
    const entrySet = new Set(entries.map(normalizeZipPath));
    const missing =
      options?.archive && entries.length
        ? refs.filter((ref) => {
            const base = ref.split('/').pop() ?? ref;
            return !entrySet.has(ref) && !entrySet.has(base);
          })
        : [];

    setTemplate(result.data);
    setFileName(name);
    setArchiveFile(options?.archive ?? null);
    setZipEntries(entries);
    setMissingFiles(missing);
    setParseError(
      missing.length
        ? `Faltan en el ZIP: ${missing.join(', ')}`
        : null,
    );
  };

  const handleJsonFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      applyParsed(parsed, file.name);
    } catch {
      setTemplate(null);
      setFileName(null);
      setArchiveFile(null);
      setZipEntries([]);
      setMissingFiles([]);
      setParseError('No se pudo leer el JSON. Revisa el formato.');
    }
  };

  const handleZipFile = async (file: File) => {
    try {
      const bytes = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(bytes);
      const entries: string[] = [];
      const jsonCandidates: { path: string; content: string }[] = [];

      for (const [rawPath, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const rel = normalizeZipPath(rawPath);
        if (!rel || rel.startsWith('__MACOSX/') || rel.endsWith('.DS_Store')) continue;
        entries.push(rel);
        if (rel.toLowerCase().endsWith('.json')) {
          jsonCandidates.push({ path: rel, content: await entry.async('string') });
        }
      }

      if (!jsonCandidates.length) {
        setParseError('El ZIP debe incluir un JSON de plantilla.');
        setTemplate(null);
        setFileName(null);
        setArchiveFile(null);
        setZipEntries([]);
        setMissingFiles([]);
        return;
      }

      const preferred =
        jsonCandidates.find((c) => /(^|\/)demo-project(\.template)?\.json$/i.test(c.path)) ??
        jsonCandidates.find((c) => /(^|\/)demo.*\.json$/i.test(c.path)) ??
        jsonCandidates[0];

      let parsed: unknown;
      try {
        parsed = JSON.parse(preferred.content);
      } catch {
        setParseError(`JSON inválido en ${preferred.path}`);
        setTemplate(null);
        setArchiveFile(null);
        return;
      }

      applyParsed(parsed, file.name, { archive: file, entries });
    } catch {
      setTemplate(null);
      setFileName(null);
      setArchiveFile(null);
      setZipEntries([]);
      setMissingFiles([]);
      setParseError('No se pudo leer el ZIP.');
    }
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
      await handleZipFile(file);
      return;
    }
    if (lower.endsWith('.json') || file.type === 'application/json') {
      await handleJsonFile(file);
      return;
    }
    setParseError('Selecciona un archivo .json o .zip');
    setTemplate(null);
    setFileName(null);
    setArchiveFile(null);
    setZipEntries([]);
    setMissingFiles([]);
  };

  const handleUseDefault = () => {
    applyParsed(demoTemplateJson, 'demo-project.template.json (incluido)');
  };

  const canSubmit = !!template && !submitting && missingFiles.length === 0;

  const handleSubmit = async () => {
    if (!template || !canSubmit) return;
    setSubmitting(true);
    try {
      const result = archiveFile
        ? await createDemoProject({
            archive: archiveFile,
            unique_sku: uniqueSku,
          })
        : await createDemoProject({
            template,
            unique_sku: uniqueSku,
          });
      await bootstrap();
      toast.success(result.message || 'Proyecto demo creado');
      onClose();
      navigate(`/projects/${result.project.id}`);
    } catch (e) {
      toast.error(getErrorMessage(e, 'No se pudo crear el proyecto demo'));
    } finally {
      setSubmitting(false);
    }
  };

  const project = template?.project;
  const referencedFiles = template ? collectReferencedFiles(template) : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Proyecto demo"
      description="Descarga la plantilla JSON, o sube un ZIP con el JSON y los ficheros de las propuestas. El demo queda con todas las fases de revisión ya aprobadas."
      size="lg"
      preventClose={submitting}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-md border border-border bg-surface text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-white font-medium disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {submitting ? 'Creando…' : 'Crear proyecto'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-border bg-surface text-slate-700 hover:bg-slate-50 text-sm font-medium"
          >
            <Download size={16} />
            Descargar plantilla JSON
          </button>
          <button
            type="button"
            onClick={handleUseDefault}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-border bg-surface text-slate-700 hover:bg-slate-50 text-sm font-medium"
          >
            <FileJson size={16} />
            Usar plantilla incluida
          </button>
        </div>

        <div className="rounded-md border border-dashed border-border bg-slate-50/60 px-3 py-2 text-xs text-slate-600 space-y-1">
          <p className="font-medium text-slate-700 inline-flex items-center gap-1.5">
            <FileArchive size={14} /> Estructura del ZIP
          </p>
          <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-600">{`demo.zip
├── demo-project.json
└── files/
    ├── propuesta-v1.pdf
    └── propuesta-v2.pdf`}</pre>
          <p>
            En el JSON, referencia los ficheros con{' '}
            <code className="text-[11px] bg-white border border-border px-1 rounded">
              proposals[].files
            </code>
            . Se suben a Supabase Storage.
          </p>
        </div>

        <div>
          <label htmlFor={fileInputId} className="block text-sm font-medium text-slate-700 mb-1.5">
            Subir JSON o ZIP
          </label>
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept="application/json,.json,application/zip,.zip,application/x-zip-compressed"
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-border file:bg-surface file:text-slate-700 hover:file:bg-slate-50"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
          {fileName && (
            <p className="mt-1.5 text-xs text-slate-500">Archivo: {fileName}</p>
          )}
          {parseError && <p className="mt-1.5 text-sm text-red-600">{parseError}</p>}
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={uniqueSku}
            onChange={(e) => setUniqueSku(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Generar SKU único si ya existe (añade un sufijo). Desmárcalo solo si quieres forzar el SKU
            del JSON.
          </span>
        </label>

        {template && project && (
          <div className="rounded-md border border-border bg-slate-50/80 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-primary">Vista previa</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Nombre</dt>
                <dd className="font-medium text-slate-800">{project.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">SKU</dt>
                <dd className="font-medium text-slate-800 font-mono text-[13px]">{project.sku}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Fase</dt>
                <dd className="font-medium text-slate-800">{project.phase}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Estado</dt>
                <dd className="font-medium text-slate-800">{project.status || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Línea / formato</dt>
                <dd className="font-medium text-slate-800">
                  {[project.product_line, project.format].filter(Boolean).join(' · ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Mercados</dt>
                <dd className="font-medium text-slate-800">
                  {project.markets?.length ? project.markets.join(', ') : '—'}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                ['Propuestas', template.proposals?.length ?? 0],
                ['Acciones', template.phase_actions?.length ?? 0],
                ['Actividad', template.activity?.length ?? 0],
                ['Tareas', template.tasks?.length ?? 0],
                ['Comentarios', template.comments?.length ?? 0],
                ['Horas', template.time_entries?.length ?? 0],
                ['Ficheros ZIP', zipEntries.filter((e) => !e.toLowerCase().endsWith('.json')).length],
              ].map(([label, count]) => (
                <span
                  key={String(label)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-xs text-slate-600"
                >
                  <span className="font-medium text-slate-800">{count}</span>
                  {label}
                </span>
              ))}
            </div>

            {referencedFiles.length > 0 && (
              <div className="pt-1 space-y-1">
                <p className="text-xs font-medium text-slate-600">Ficheros referenciados</p>
                <ul className="text-xs text-slate-600 space-y-0.5">
                  {referencedFiles.map((ref) => {
                    const missing = missingFiles.includes(ref);
                    return (
                      <li
                        key={ref}
                        className={missing ? 'text-red-600 font-mono' : 'font-mono text-slate-700'}
                      >
                        {missing ? '✗ ' : archiveFile ? '✓ ' : '· '}
                        {ref}
                      </li>
                    );
                  })}
                </ul>
                {!archiveFile && (
                  <p className="text-[11px] text-amber-700">
                    Sin ZIP: las referencias a ficheros se omiten al crear el proyecto.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {!template && !parseError && (
          <p className="text-sm text-slate-500">
            Sube un JSON o un ZIP (JSON + files), o usa la plantilla incluida para previsualizar y
            crear.
          </p>
        )}
      </div>
    </Modal>
  );
}

'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, FilePlus2, ImagePlus, Loader2, Sparkles, Wand2, X } from 'lucide-react';
import * as api from '../api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { CreateProjectFromMoodboardModal } from '../components/modals/CreateProjectFromMoodboardModal';
import { useAppStore } from '../store/useAppStore';
import { getErrorMessage } from '../utils/errors';
import { loadArrayBufferFromUrl } from '../utils/files';
import type { Project } from '../types';

type Proposal = {
  id: string;
  label: string;
  url: string;
  storage_key: string | null;
  revised_prompt: string | null;
};

type RefItem = {
  id: string;
  file: File;
  previewUrl: string;
  /** Revocar con URL.revokeObjectURL al quitar (uploads y thumbs de proyecto). */
  revokeOnRemove: boolean;
  source: 'upload' | 'project';
  projectId?: string;
  label: string;
};

const MAX_REFS = 3;

const EXAMPLES = [
  'Mermelada artesanal de fresa, tarro de vidrio, look gourmet mediterráneo, tonos coral y crema',
  'Snack proteico vegano en doypack, estética deportiva moderna, azul y lima',
  'Aceite de oliva premium exportación, etiqueta minimalista negra y dorada',
];

async function thumbnailToFile(project: Project): Promise<File> {
  const thumb = project.thumbnail;
  if (!thumb) throw new Error('El proyecto no tiene thumbnail');
  const url = thumb.downloadUrl || thumb.dataUrl;
  if (!url) throw new Error('URL del thumbnail no disponible');
  const buffer = await loadArrayBufferFromUrl(url);
  const type = thumb.mimeType || 'image/jpeg';
  const fileName = (thumb.fileName || `${project.sku || project.name}-thumb.jpg`).replace(
    /[^\w.\-]+/g,
    '_',
  );
  return new File([buffer], fileName, { type });
}

export default function Moodboard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projects = useAppStore((s) => s.projects);
  const [prompt, setPrompt] = useState('');
  const [refs, setRefs] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickingThumb, setPickingThumb] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [usedReferences, setUsedReferences] = useState(0);
  const [useProjectThumbs, setUseProjectThumbs] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [briefingProposal, setBriefingProposal] = useState<Proposal | null>(null);

  const canGenerate = prompt.trim().length >= 8 && !loading;

  const projectsWithThumb = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    return projects
      .filter((p) => !p.archived && p.thumbnail?.dataUrl)
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.productLine ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [projects, projectSearch]);

  const selectedProjectIds = useMemo(
    () => new Set(refs.filter((r) => r.source === 'project' && r.projectId).map((r) => r.projectId!)),
    [refs],
  );

  const refLabel = useMemo(() => {
    if (refs.length === 0) return 'Sin referencias de estilo';
    return `${refs.length} diseño${refs.length > 1 ? 's' : ''} de referencia`;
  }, [refs.length]);

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!incoming.length) {
      setError('Solo se admiten imágenes (PNG, JPG, WEBP).');
      return;
    }

    setError(null);
    setRefs((prev) => {
      const room = MAX_REFS - prev.length;
      if (room <= 0) return prev;
      const next = incoming.slice(0, room).map((file) => ({
        id: `upload-${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        revokeOnRemove: true,
        source: 'upload' as const,
        label: file.name,
      }));
      return [...prev, ...next];
    });
  };

  const addProjectThumbnail = async (project: Project) => {
    if (!project.thumbnail?.dataUrl) return;
    if (selectedProjectIds.has(project.id)) return;
    if (refs.length >= MAX_REFS) {
      setError(`Máximo ${MAX_REFS} referencias.`);
      return;
    }

    setError(null);
    setPickingThumb(true);
    try {
      const file = await thumbnailToFile(project);
      setRefs((prev) => {
        if (prev.length >= MAX_REFS) return prev;
        if (prev.some((r) => r.projectId === project.id)) return prev;
        return [
          ...prev,
          {
            id: `project-${project.id}`,
            file,
            // Blob local: el dataUrl firmado de Supabase caduca y rompe el <img>.
            previewUrl: URL.createObjectURL(file),
            revokeOnRemove: true,
            source: 'project',
            projectId: project.id,
            label: project.name,
          },
        ];
      });
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo añadir el thumbnail del proyecto'));
    } finally {
      setPickingThumb(false);
    }
  };

  const removeRef = (id: string) => {
    setRefs((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target?.revokeOnRemove) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((r) => r.id !== id);
    });
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.generateMoodboard(
        prompt,
        refs.map((r) => r.file),
      );
      setProposals(result.proposals);
      setLastPrompt(result.prompt);
      setUsedReferences(result.used_references ?? refs.length);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo generar el moodboard'));
      setProposals([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Sparkles className="text-accent" size={26} />
          Moodboard
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Genera 3 propuestas de inspiración creativa. Opcional: sube diseños propios o usa
          thumbnails de proyectos para guiar el estilo artístico.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brief creativo</CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Describe el producto y, si quieres, adjunta hasta {MAX_REFS} diseños de referencia.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-5">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Ej.: Conserva de tomates cherry en tarro, look mediterráneo fresco, tipografía moderna, para retail España…"
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-y min-h-[100px]"
              disabled={loading}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-primary">Referencias de estilo</p>
                  <p className="text-xs text-slate-500">
                    {refLabel} · máx. {MAX_REFS} · PNG/JPG/WEBP
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs text-slate-600">Thumbnails de proyectos</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={useProjectThumbs}
                      disabled={loading}
                      onClick={() => setUseProjectThumbs((v) => !v)}
                      className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        useProjectThumbs ? 'bg-accent' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          useProjectThumbs ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </label>
                  <button
                    type="button"
                    disabled={loading || refs.length >= MAX_REFS}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm text-slate-700 hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
                  >
                    <ImagePlus size={16} />
                    Subir diseños
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>

              {useProjectThumbs && (
                <div className="rounded-lg border border-border bg-slate-50/80 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-slate-600">
                      Elige thumbnails de proyectos existentes
                      {pickingThumb && (
                        <span className="ml-2 inline-flex items-center gap-1 text-accent">
                          <Loader2 size={12} className="animate-spin" /> cargando…
                        </span>
                      )}
                    </p>
                    <input
                      type="search"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Buscar por nombre o SKU…"
                      disabled={loading}
                      className="w-full sm:w-56 px-2.5 py-1.5 text-xs border border-border rounded-md bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                  {projectsWithThumb.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      No hay proyectos con thumbnail
                      {projectSearch.trim() ? ' que coincidan con la búsqueda' : ''}.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                      {projectsWithThumb.map((p) => {
                        const selected = selectedProjectIds.has(p.id);
                        const disabled =
                          loading || pickingThumb || refs.length >= MAX_REFS || selected;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => void addProjectThumbnail(p)}
                            title={selected ? 'Ya añadido' : `Usar thumbnail de ${p.name}`}
                            className={`relative aspect-square rounded-md overflow-hidden border text-left transition-all ${
                              selected
                                ? 'border-accent ring-2 ring-accent/30 opacity-90'
                                : 'border-border hover:border-accent hover:ring-1 hover:ring-accent/20'
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.thumbnail!.dataUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[9px] px-1 py-0.5 truncate">
                              {p.name}
                            </span>
                            {selected && (
                              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {refs.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {refs.map((ref) => (
                    <div
                      key={ref.id}
                      className="relative aspect-square rounded-lg border border-border overflow-hidden bg-slate-50 group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ref.previewUrl}
                        alt={ref.label}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        title="Quitar"
                        disabled={loading}
                        onClick={() => removeRef(ref.id)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                      <p className="absolute bottom-0 inset-x-0 text-[10px] px-1.5 py-1 bg-black/50 text-white truncate">
                        {ref.source === 'project' ? `Proyecto · ${ref.label}` : ref.label}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                  }}
                  className="w-full border border-dashed border-border rounded-lg px-4 py-8 text-center text-sm text-slate-400 hover:border-accent hover:text-accent transition-colors"
                >
                  Arrastra aquí diseños existentes o pulsa para seleccionar
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={loading}
                  onClick={() => setPrompt(ex)}
                  className="text-xs px-2.5 py-1 rounded-md border border-border bg-slate-50 text-slate-600 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                >
                  {ex.slice(0, 48)}…
                </button>
              ))}
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!canGenerate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {loading ? 'Generando 3 propuestas…' : 'Generar 3 propuestas'}
              </button>
              {loading && (
                <span className="text-xs text-slate-500">
                  {refs.length > 0
                    ? 'Usando referencias de estilo…'
                    : 'GPT Image × 3 propuestas'}
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {proposals.length > 0 && (
        <div className="space-y-3">
          {lastPrompt && (
            <p className="text-sm text-slate-500">
              Resultado para: <span className="text-primary font-medium">{lastPrompt}</span>
              {usedReferences > 0 && (
                <span className="ml-2 text-xs text-accent">
                  · con {usedReferences} referencia{usedReferences > 1 ? 's' : ''}
                </span>
              )}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {proposals.map((p) => (
              <article
                key={p.id}
                className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col"
              >
                <div className="aspect-square bg-slate-100 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-primary">{p.label}</h3>
                  {p.revised_prompt && (
                    <p className="text-xs text-slate-500 line-clamp-3" title={p.revised_prompt}>
                      {p.revised_prompt}
                    </p>
                  )}
                  <div className="mt-auto flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setBriefingProposal(p)}
                      className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
                    >
                      <FilePlus2 size={14} />
                      Crear briefing a partir de esta imagen
                    </button>
                    <a
                      href={p.url}
                      download={`${p.label.replace(/\s+/g, '-').toLowerCase()}.png`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-accent hover:underline"
                    >
                      <Download size={14} />
                      Descargar / abrir
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {!loading && proposals.length === 0 && !error && (
        <div className="border border-dashed border-border rounded-xl p-10 text-center text-slate-400 text-sm">
          Las 3 propuestas aparecerán aquí tras generar.
        </div>
      )}

      <CreateProjectFromMoodboardModal
        open={Boolean(briefingProposal)}
        proposal={briefingProposal}
        creativeBrief={lastPrompt}
        onClose={() => setBriefingProposal(null)}
      />
    </div>
  );
}

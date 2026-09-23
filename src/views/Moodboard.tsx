'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, ImagePlus, Loader2, Sparkles, Wand2, X } from 'lucide-react';
import * as api from '../api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { getErrorMessage } from '../utils/errors';

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
};

const MAX_REFS = 3;

const EXAMPLES = [
  'Mermelada artesanal de fresa, tarro de vidrio, look gourmet mediterráneo, tonos coral y crema',
  'Snack proteico vegano en doypack, estética deportiva moderna, azul y lima',
  'Aceite de oliva premium exportación, etiqueta minimalista negra y dorada',
];

export default function Moodboard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [refs, setRefs] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [usedReferences, setUsedReferences] = useState(0);

  const canGenerate = prompt.trim().length >= 8 && !loading;

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
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...next];
    });
  };

  const removeRef = (id: string) => {
    setRefs((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
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
          Genera 3 propuestas de inspiración creativa. Opcional: sube diseños propios para guiar el
          estilo artístico.
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-primary">Referencias de estilo</p>
                  <p className="text-xs text-slate-500">{refLabel} · máx. {MAX_REFS} · PNG/JPG/WEBP</p>
                </div>
                <button
                  type="button"
                  disabled={loading || refs.length >= MAX_REFS}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm text-slate-700 hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
                >
                  <ImagePlus size={16} />
                  Subir diseños
                </button>
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
                        alt={ref.file.name}
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
                        {ref.file.name}
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
                    ? 'Usando tus diseños como estilo de referencia…'
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
                  <a
                    href={p.url}
                    download={`${p.label.replace(/\s+/g, '-').toLowerCase()}.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                  >
                    <Download size={14} />
                    Descargar / abrir
                  </a>
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
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, Trash2, Upload } from 'lucide-react';

import { Modal } from '../ui/Modal';
import { useAppStore } from '../../store/useAppStore';
import { formatFileSize } from '../../utils/files';
import { getErrorMessage } from '../../utils/errors';
import type { ProjectPhase } from '../../types';

interface UploadDesignModalProps {
  open: boolean;
  projectId: string;
  suggestedVersion: string;
  currentPhase?: ProjectPhase;
  existingProposalName?: string;
  existingProposalVersion?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

interface PendingFile {
  id: string;
  file: File;
  previewUrl?: string;
}

export const UploadDesignModal: React.FC<UploadDesignModalProps> = ({
  open,
  projectId,
  suggestedVersion,
  currentPhase,
  existingProposalName,
  existingProposalVersion,
  onClose,
  onSubmitted,
}) => {
  const addDesignProposal = useAppStore((s) => s.addDesignProposal);
  const project = useAppStore((s) => s.projects.find((p) => p.id === projectId));
  const isAvFlow = project?.flowType === 'Campaña audiovisual';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDesarrollo = currentPhase === 'Creación Desarrollo';
  const isAppendMode = currentPhase === 'Aprobación Diseño';

  const [name, setName] = useState('');
  const [version, setVersion] = useState(suggestedVersion);
  const [comments, setComments] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(isAppendMode ? (existingProposalName ?? '') : '');
      setVersion(isAppendMode ? (existingProposalVersion ?? suggestedVersion) : suggestedVersion);
      setComments('');
      setFiles([]);
      setError(null);
      setSubmitting(false);
    }
  }, [open, suggestedVersion, isAppendMode, existingProposalName, existingProposalVersion]);

  const handleFiles = (fileList: FileList | File[]) => {
    setError(null);
    const list = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}`,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setFiles((prev) => [...prev, ...list]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const canSubmit = useMemo(() => {
    if (files.length === 0) return false;
    if (isAppendMode) return true;
    return name.trim().length > 0 && version.trim().length > 0;
  }, [name, version, files, isAppendMode]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError(
        isAppendMode
          ? 'Adjunta al menos un archivo.'
          : 'Completa el nombre, la versión y adjunta al menos un archivo.',
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const proposalName =
        name.trim() || existingProposalName || 'Propuesta de diseño';
      const proposalVersion =
        version.trim() || existingProposalVersion || suggestedVersion;

      await addDesignProposal(
        projectId,
        proposalName,
        proposalVersion,
        comments.trim(),
        files.map((f) => f.file),
      );
      onSubmitted?.();
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'Error al subir la propuesta'));
    } finally {
      setSubmitting(false);
    }
  };

  const nextPhaseLabel = isDesarrollo
    ? isAvFlow
      ? 'Aprobación Marketing'
      : 'Validación diseño'
    : isAvFlow
      ? 'Aprobación Marketing'
      : 'Aprobación Diseño';

  const title = isDesarrollo
    ? 'Subir archivo de desarrollo'
    : isAppendMode
      ? 'Añadir archivos a la propuesta'
      : 'Subir propuesta de diseño';

  const description = isAppendMode
    ? 'Los archivos se añadirán a la propuesta en revisión. El proyecto seguirá en Aprobación Diseño.'
    : `Adjunta el archivo${isDesarrollo ? ' técnico de desarrollo' : ' de arte propuesto'}. Al guardar, el proyecto pasará automáticamente a ${nextPhaseLabel}.`;

  const submitLabel = submitting
    ? 'Subiendo…'
    : isAppendMode
      ? 'Añadir archivos'
      : isDesarrollo
        ? 'Guardar y enviar a aprobación legal'
        : 'Guardar y enviar a revisión';

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventClose={submitting}
      title={title}
      description={description}
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-md border border-border bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {isAppendMode && existingProposalName && (
          <div className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-slate-700">
            <span className="font-medium text-primary">{existingProposalName}</span>
            {existingProposalVersion && (
              <span className="ml-2 font-mono text-xs text-slate-500">{existingProposalVersion}</span>
            )}
          </div>
        )}

        {!isAppendMode && (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Nombre <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  isDesarrollo
                    ? 'Ej. Desarrollo técnico pack verano 2026'
                    : 'Ej. Propuesta visual frente — Verano 2026'
                }
                className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Versión <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0"
                className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </label>
          </div>
        )}

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Comentarios{isAppendMode ? ' (opcional)' : ''}
          </span>
          <textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={isAppendMode ? 'Notas sobre los archivos añadidos…' : undefined}
            className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
          />
        </label>

        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Adjuntos <span className="text-red-500">*</span>
          </span>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 px-4 text-sm cursor-pointer transition-colors ${
              isDragging
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-slate-200 text-slate-500 hover:border-accent hover:bg-accent/5'
            }`}
          >
            <Upload size={20} />
            <span>
              <span className="text-accent font-medium">Haz clic para subir</span> o arrastra los archivos
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={
              isDesarrollo || isAvFlow
                ? 'image/*,video/*,.mp4,.mov,.webm,.pdf,.ai,.psd,.zip,application/zip'
                : 'image/*,.pdf,.ai,.psd'
            }
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />

          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 border border-border rounded-lg"
                >
                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="w-12 h-12 object-cover rounded-md border border-border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-white border border-border flex items-center justify-center text-slate-500">
                      <FileText size={18} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{item.file.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(Math.max(1, Math.round(item.file.size / 1024)))}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile(item.id)}
                    className="p-2 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquare, XCircle } from 'lucide-react';

import { Modal } from '../ui/Modal';
import { getErrorMessage } from '../../utils/errors';
import type { ProjectPhase } from '../../types';
import { nextPhase as nextPhaseFn, prevPhase as prevPhaseFn } from '../../utils/phase';

interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  currentPhase: ProjectPhase;
  /** Texto que se inyecta en el textarea al abrir (p. ej. anotaciones previas sobre la imagen). */
  defaultText?: string;
}

const textareaClass =
  'w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none disabled:opacity-60';

interface CommentModalProps extends BaseModalProps {
  onSubmit: (comment: string) => void | Promise<void>;
}

export const CommentModal: React.FC<CommentModalProps> = ({
  open,
  onClose,
  currentPhase,
  defaultText,
  onSubmit,
}) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText(defaultText ?? '');
      setSubmitting(false);
      setError(null);
    }
  }, [open, defaultText]);

  const canSubmit = text.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'Error al enviar el comentario'));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventClose={submitting}
      size="md"
      title="Añadir comentario"
      description={`Tu comentario quedará registrado en la fase "${currentPhase}" y notificará al equipo.`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-md border border-border bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <MessageSquare size={16} /> Enviar comentario
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe tu comentario, observación o pregunta…"
          className={textareaClass}
          disabled={submitting}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
};

interface RejectModalProps extends BaseModalProps {
  onSubmit: (comment: string) => void | Promise<void>;
}

export const RejectModal: React.FC<RejectModalProps> = ({
  open,
  onClose,
  currentPhase,
  defaultText,
  onSubmit,
}) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText(defaultText ?? '');
      setSubmitting(false);
      setError(null);
    }
  }, [open, defaultText]);

  const canSubmit = text.trim().length > 0 && !submitting;
  const returnPhase = prevPhaseFn(currentPhase);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'Error al rechazar la fase'));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventClose={submitting}
      size="md"
      title="Rechazar y devolver al equipo"
      description={`El proyecto volverá a la fase "${returnPhase}" con el estado "Cambios solicitados". Indica el motivo del rechazo.`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-md border border-border bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <XCircle size={16} /> Rechazar
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Estás revisando la fase <strong>{currentPhase}</strong>. El proyecto volverá a{' '}
          <strong>{returnPhase}</strong> para que el equipo responsable pueda subir la documentación
          corregida.
        </div>
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe los cambios solicitados (claim, color, texto legal, layout…)"
          className={textareaClass}
          disabled={submitting}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
};

interface ApproveModalProps extends BaseModalProps {
  onSubmit: (comment?: string) => void | Promise<void>;
}

export const ApproveModal: React.FC<ApproveModalProps> = ({
  open,
  onClose,
  currentPhase,
  onSubmit,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upcoming = nextPhaseFn(currentPhase);
  const isFinal = upcoming === currentPhase;

  useEffect(() => {
    if (open) {
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(undefined);
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'Error al aprobar la fase'));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventClose={submitting}
      size="md"
      title={isFinal ? 'Cerrar y aprobar definitivamente' : `Aprobar fase "${currentPhase}"`}
      description={
        isFinal
          ? 'Marcará el proyecto como Aprobado y bloqueará nuevas modificaciones.'
          : `Al aprobar, el proyecto avanzará a la fase "${upcoming}".`
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-md border border-border bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Procesando…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                {isFinal ? 'Cerrar proyecto' : `Aprobar y pasar a ${upcoming}`}
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          Confirmas que la fase <strong>{currentPhase}</strong> está revisada y cumple los requisitos.
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
};

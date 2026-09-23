import { useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  FileText,
  Hash,
  ImageIcon,
  Loader2,
  MessageCircle,
  MessageSquare,
  Send,
  Sparkles,
  ThumbsUp,
  Upload,
  XCircle,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ImageAnnotator } from '../../components/ui/ImageAnnotator';
import { useAppStore } from '../../store/useAppStore';
import type {
  ActivityEvent,
  ActivityReply,
  DesignProposal,
  PhaseAction,
  ProjectAttachment,
} from '../../types';
import { formatDateTime as formatDate } from '../../utils/dates';

const ROLES_COLORS: Record<string, string> = {
  Marketing: 'bg-blue-100 text-blue-700',
  Diseño: 'bg-purple-100 text-purple-700',
  Calidad: 'bg-amber-100 text-amber-700',
  Legal: 'bg-red-100 text-red-700',
  Impresión: 'bg-cyan-100 text-cyan-700',
  Admin: 'bg-emerald-100 text-emerald-700',
};

const roleColor = (role: string) =>
  ROLES_COLORS[role] ?? 'bg-slate-100 text-slate-600';

type EventConfig = {
  icon: React.ReactNode;
  dotClass: string;
  cardClass: string;
  labelClass: string;
};

const getEventConfig = (type: ActivityEvent['type']): EventConfig => {
  switch (type) {
    case 'PROJECT_CREATED':
      return {
        icon: <Sparkles size={15} />,
        dotClass: 'bg-accent border-accent/30 text-white',
        cardClass: 'border-accent/20 bg-accent/5',
        labelClass: 'text-accent',
      };
    case 'NEW_VERSION':
      return {
        icon: <Upload size={15} />,
        dotClass: 'bg-purple-500 border-purple-200 text-white',
        cardClass: 'border-purple-200 bg-purple-50/50',
        labelClass: 'text-purple-700',
      };
    case 'DOCUMENT_UPLOADED':
      return {
        icon: <FileText size={15} />,
        dotClass: 'bg-blue-500 border-blue-200 text-white',
        cardClass: 'border-blue-100 bg-blue-50/40',
        labelClass: 'text-blue-700',
      };
    case 'REVIEW_APPROVED':
      return {
        icon: <ThumbsUp size={15} />,
        dotClass: 'bg-emerald-500 border-emerald-200 text-white',
        cardClass: 'border-emerald-200 bg-emerald-50/60',
        labelClass: 'text-emerald-700',
      };
    case 'REVIEW_REJECTED':
      return {
        icon: <XCircle size={15} />,
        dotClass: 'bg-red-500 border-red-200 text-white',
        cardClass: 'border-red-200 bg-red-50/60',
        labelClass: 'text-red-700',
      };
    case 'COMMENT_ADDED':
      return {
        icon: <MessageSquare size={15} />,
        dotClass: 'bg-slate-400 border-slate-200 text-white',
        cardClass: 'border-slate-200 bg-white',
        labelClass: 'text-slate-600',
      };
    case 'PHASE_CHANGED':
      return {
        icon: <CheckCircle2 size={15} />,
        dotClass: 'bg-amber-500 border-amber-200 text-white',
        cardClass: 'border-amber-100 bg-amber-50/40',
        labelClass: 'text-amber-700',
      };
    case 'SAP_CODE_ASSIGNED':
      return {
        icon: <Hash size={15} />,
        dotClass: 'bg-indigo-500 border-indigo-200 text-white',
        cardClass: 'border-indigo-200 bg-indigo-50/50',
        labelClass: 'text-indigo-700',
      };
    case 'TASK_COMPLETED':
      return {
        icon: <CheckSquare size={15} />,
        dotClass: 'bg-teal-500 border-teal-200 text-white',
        cardClass: 'border-teal-100 bg-teal-50/40',
        labelClass: 'text-teal-700',
      };
    default:
      return {
        icon: <Activity size={15} />,
        dotClass: 'bg-slate-300 border-slate-200 text-white',
        cardClass: 'border-border bg-white',
        labelClass: 'text-slate-600',
      };
  }
};

const EVENT_LABELS: Record<ActivityEvent['type'], string> = {
  PROJECT_CREATED: 'Proyecto creado',
  NEW_VERSION: 'Nueva versión subida',
  DOCUMENT_UPLOADED: 'Documento subido',
  REVIEW_APPROVED: 'Aprobación',
  REVIEW_REJECTED: 'Rechazo',
  COMMENT_ADDED: 'Comentario',
  PHASE_CHANGED: 'Cambio de fase',
  TASK_COMPLETED: 'Tarea completada',
  SAP_CODE_ASSIGNED: 'Código SAP',
};

interface ReplyBoxProps {
  onSubmit: (text: string) => void | Promise<void>;
}

const ReplyBox: React.FC<ReplyBoxProps> = ({ onSubmit }) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-start gap-2 mt-2">
      <CornerDownRight size={14} className="text-slate-300 mt-2.5 shrink-0" />
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void send();
          }}
          placeholder="Escribe una respuesta… (Ctrl+Enter para enviar)"
          rows={2}
          disabled={submitting}
          className="w-full px-3 py-2 pr-10 bg-white border border-border rounded-lg text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none disabled:opacity-60"
        />
        <button
          onClick={() => void send()}
          disabled={!text.trim() || submitting}
          className="absolute right-2 bottom-2 p-1.5 rounded-md text-slate-400 hover:text-accent disabled:opacity-40 transition-colors"
          title="Enviar (Ctrl+Enter)"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
};

interface ReplyThreadProps {
  replies: ActivityReply[];
}

const ReplyThread: React.FC<ReplyThreadProps> = ({ replies }) => {
  if (replies.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5 pl-6 border-l-2 border-slate-100">
      {replies.map((r) => (
        <div key={r.id} className="flex items-start gap-2">
          <div
            className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${roleColor(r.role)}`}
          >
            {r.author}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800 leading-snug break-words">{r.text}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(r.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

interface EventCardProps {
  event: ActivityEvent;
  phaseAction?: PhaseAction;
  replies: ActivityReply[];
  onReply: (text: string) => void | Promise<void>;
  /** Si hay imagen anotable para este evento, estos datos se proporcionan. */
  annotationContext?: {
    proposal: DesignProposal;
    attachment: ProjectAttachment;
    projectId: string;
  };
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  phaseAction,
  replies,
  onReply,
  annotationContext,
}) => {
  const cfg = getEventConfig(event.type);
  const [replyOpen, setReplyOpen] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [annotatorOpen, setAnnotatorOpen] = useState(false);
  const replyCount = replies.length;

  const showAnnotationBtn =
    !!annotationContext &&
    (event.type === 'COMMENT_ADDED' ||
      event.type === 'REVIEW_APPROVED' ||
      event.type === 'REVIEW_REJECTED') &&
    !!phaseAction &&
    (phaseAction.phase === 'Aprobación Diseño' ||
      phaseAction.phase === 'Validación diseño' ||
      phaseAction.phase === 'Aprobación Legal');

  return (
    <>
      <div className="flex gap-4">
        {/* Dot */}
        <div className="flex flex-col items-center">
          <div
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${cfg.dotClass}`}
          >
            {cfg.icon}
          </div>
          <div className="flex-1 w-px bg-slate-200 mt-1" />
        </div>

        {/* Content */}
        <div className="pb-8 flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cardClass} ${cfg.labelClass}`}
            >
              {EVENT_LABELS[event.type] ?? event.type}
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded ${roleColor(event.actor)}`}
            >
              {event.actor}
            </span>
            <span className="text-[11px] text-slate-400">{formatDate(event.createdAt)}</span>
          </div>

          {/* Card */}
          <div className={`rounded-xl border p-3.5 ${cfg.cardClass}`}>
            {/* Event headline */}
            <p className="text-sm font-medium text-primary">{event.text}</p>

            {/* PhaseAction comment bubble */}
            {phaseAction?.comment && (
              <div className="mt-2.5 bg-white/70 rounded-lg border border-white px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
                  <MessageCircle size={11} />
                  Mensaje
                </div>
                <p className="text-sm text-slate-800 leading-relaxed">{phaseAction.comment}</p>
              </div>
            )}

            {/* "Ver en imagen" button */}
            {showAnnotationBtn && (
              <button
                type="button"
                onClick={() => setAnnotatorOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-accent/50 text-xs font-medium text-slate-600 hover:text-accent transition-colors"
              >
                <ImageIcon size={13} />
                Ver comentarios en imagen
                {phaseAction?.phase && (
                  <span className="text-[10px] text-slate-400 ml-1">· {phaseAction.phase}</span>
                )}
              </button>
            )}

            {/* Replies thread */}
            {replyCount > 0 && (
              <button
                type="button"
                onClick={() => setShowReplies((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-primary mt-2.5 font-medium transition-colors"
              >
                {showReplies ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {replyCount} respuesta{replyCount !== 1 ? 's' : ''}
              </button>
            )}

            {showReplies && <ReplyThread replies={replies} />}

            {/* Reply toggle */}
            <div className="mt-3 border-t border-black/5 pt-2.5">
              {replyOpen ? (
                <div>
                  <ReplyBox
                    onSubmit={(t) => {
                      onReply(t);
                      setReplyOpen(false);
                      setShowReplies(true);
                    }}
                  />
                  <button
                    onClick={() => setReplyOpen(false)}
                    className="mt-1.5 text-[11px] text-slate-400 hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setReplyOpen(true)}
                  className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-accent font-medium transition-colors"
                >
                  <CornerDownRight size={12} /> Responder
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ImageAnnotator modal (read-only) */}
      {annotationContext && annotatorOpen && (
        <ImageAnnotator
          open={annotatorOpen}
          attachment={annotationContext.attachment}
          proposal={annotationContext.proposal}
          projectId={annotationContext.projectId}
          readOnly
          onClose={() => setAnnotatorOpen(false)}
        />
      )}
    </>
  );
};

export const TabActividad = ({ projectId }: { projectId: string }) => {
  const {
    activity,
    phaseActions,
    activityReplies,
    designProposals,
    addActivityReply,
  } = useAppStore();

  const projectEvents = activity
    .filter((a) => a.projectId === projectId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Latest proposal + first image attachment for this project
  const latestProposal = designProposals
    .filter((d) => d.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const firstImageAttachment = latestProposal?.attachments.find((a) => a.isImage || a.isPdf);

  const annotationContext =
    latestProposal && firstImageAttachment
      ? { proposal: latestProposal, attachment: firstImageAttachment, projectId }
      : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Actividad del proyecto</h2>
          <p className="text-sm text-slate-500 mt-1">
            Hilo cronológico de todos los eventos: fases, revisiones, comentarios y respuestas.
          </p>
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
          {projectEvents.length} evento{projectEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Línea de tiempo</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {projectEvents.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No hay actividad registrada todavía.
            </p>
          ) : (
            <div className="mt-2">
              {projectEvents.map((event) => {
                const phaseAction = event.phaseActionId
                  ? phaseActions.find((pa) => pa.id === event.phaseActionId)
                  : undefined;

                const replies = activityReplies
                  .filter((r) => r.eventId === event.id)
                  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    phaseAction={phaseAction}
                    replies={replies}
                    onReply={(text) => addActivityReply(event.id, projectId, text)}
                    annotationContext={annotationContext}
                  />
                );
              })}

              {/* End cap */}
              <div className="flex gap-4">
                <div className="w-8 flex justify-center">
                  <div className="w-2 h-2 rounded-full bg-slate-200 mt-1" />
                </div>
                <p className="text-xs text-slate-400 pb-2">Inicio del proyecto</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

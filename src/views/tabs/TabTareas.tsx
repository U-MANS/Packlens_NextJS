import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  Circle,
  Loader2,
  MessageSquare,
  Plus,
  Square,
} from 'lucide-react';

import { useAppStore } from '../../store/useAppStore';
import type { Comment, Task } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import { formatDate } from '../../utils/dates';

const KanbanColumn: React.FC<{
  title: string;
  count: number;
  accentClass: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ title, count, accentClass, children, footer }) => (
  <section className="flex flex-col min-h-[420px] min-w-[260px] flex-1 rounded-xl border border-border bg-slate-50/80 overflow-hidden">
    <header className={`px-4 py-3 border-b border-border flex items-center justify-between ${accentClass}`}>
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/80 border border-border text-slate-600">
        {count}
      </span>
    </header>
    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">{children}</div>
    {footer && <div className="p-3 border-t border-border bg-white/70">{footer}</div>}
  </section>
);

const TaskCard: React.FC<{
  task: Task;
  onToggle: () => void;
  busy?: boolean;
}> = ({ task, onToggle, busy }) => {
  const done = task.status === 'Completada';
  return (
    <article
      className={`rounded-lg border bg-white p-3 shadow-sm transition-colors ${
        done ? 'border-emerald-200 bg-emerald-50/40' : 'border-border hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          className={`mt-0.5 shrink-0 transition-colors disabled:opacity-50 ${
            done ? 'text-emerald-600' : 'text-slate-300 hover:text-accent'
          }`}
          title={done ? 'Marcar como pendiente' : 'Marcar como completada'}
        >
          {done ? <CheckSquare size={18} /> : <Square size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium leading-snug ${
              done ? 'line-through text-slate-400' : 'text-primary'
            }`}
          >
            {task.title}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-slate-500">
            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-medium">{task.role}</span>
            {task.owner && <span>{task.owner}</span>}
            {task.dueDate && (
              <span className={task.priority === 'Alta' && !done ? 'text-red-500 font-medium' : ''}>
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

const CommentCard: React.FC<{
  comment: Comment;
  onResolve?: () => void;
  busy?: boolean;
}> = ({ comment, onResolve, busy }) => (
  <article
    className={`rounded-lg border bg-white p-3 shadow-sm ${
      comment.resolved ? 'border-slate-200 opacity-80' : 'border-border hover:border-slate-300'
    }`}
  >
    <div className="flex items-start gap-2.5">
      <div
        className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          comment.resolved ? 'bg-slate-100 text-slate-400' : 'bg-accent/10 text-accent'
        }`}
      >
        <MessageSquare size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary truncate">
              {comment.author || 'Usuario'}
              <span className="ml-1.5 font-normal text-slate-400">({comment.role})</span>
            </p>
          </div>
          <span className="text-[10px] text-slate-400 shrink-0">{formatDate(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-slate-700 mt-1.5 leading-snug whitespace-pre-wrap">{comment.text}</p>
        {!comment.resolved && onResolve && (
          <button
            type="button"
            onClick={onResolve}
            disabled={busy}
            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-emerald-700 px-2 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 size={12} /> Cerrar comentario
          </button>
        )}
        {comment.resolved && (
          <p className="mt-2 text-[11px] font-medium text-slate-400 inline-flex items-center gap-1">
            <CheckCircle2 size={12} /> Cerrado
          </p>
        )}
      </div>
    </div>
  </article>
);

const QuickAdd: React.FC<{
  placeholder: string;
  submitLabel: string;
  onSubmit: (value: string) => Promise<void>;
}> = ({ placeholder, submitLabel, onSubmit }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value);
      setText('');
      setOpen(false);
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo guardar'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 hover:text-accent px-3 py-2 rounded-md border border-dashed border-slate-300 hover:border-accent/40 hover:bg-accent/5 transition-colors"
      >
        <Plus size={13} /> {submitLabel}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        autoFocus
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={busy}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handleSubmit();
          if (e.key === 'Escape') {
            setOpen(false);
            setText('');
            setError(null);
          }
        }}
        className="w-full px-2.5 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none disabled:opacity-60"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setText('');
            setError(null);
          }}
          disabled={busy}
          className="text-xs font-medium text-slate-500 hover:text-primary px-2 py-1 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!text.trim() || busy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Añadir
        </button>
      </div>
    </div>
  );
};

export const TabTareas = ({ projectId }: { projectId: string }) => {
  const {
    tasks,
    comments,
    toggleTask,
    resolveComment,
    addTask,
    addComment,
  } = useAppStore();
  const [busyId, setBusyId] = useState<string | null>(null);

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === projectId),
    [tasks, projectId],
  );
  const pendingTasks = useMemo(
    () => projectTasks.filter((t) => t.status === 'Pendiente'),
    [projectTasks],
  );
  const doneTasks = useMemo(
    () => projectTasks.filter((t) => t.status === 'Completada'),
    [projectTasks],
  );

  const projectComments = useMemo(
    () =>
      comments
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [comments, projectId],
  );
  const openComments = useMemo(
    () => projectComments.filter((c) => !c.resolved),
    [projectComments],
  );
  const closedComments = useMemo(
    () => projectComments.filter((c) => c.resolved),
    [projectComments],
  );

  const runBusy = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-primary">Tablero de tareas</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Mini-kanban con tareas y comentarios simples del proyecto.
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        <KanbanColumn
          title="Tareas pendientes"
          count={pendingTasks.length}
          accentClass="bg-amber-50/80"
          footer={
            <QuickAdd
              placeholder="Describe la tarea…"
              submitLabel="Nueva tarea"
              onSubmit={(title) => addTask(projectId, title)}
            />
          }
        >
          {pendingTasks.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8 px-2">
              No hay tareas pendientes.
            </p>
          ) : (
            pendingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                busy={busyId === task.id}
                onToggle={() => void runBusy(task.id, () => toggleTask(task.id))}
              />
            ))
          )}
        </KanbanColumn>

        <KanbanColumn
          title="Tareas completadas"
          count={doneTasks.length}
          accentClass="bg-emerald-50/80"
        >
          {doneTasks.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8 px-2">
              Aún no hay tareas completadas.
            </p>
          ) : (
            doneTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                busy={busyId === task.id}
                onToggle={() => void runBusy(task.id, () => toggleTask(task.id))}
              />
            ))
          )}
        </KanbanColumn>

        <KanbanColumn
          title="Comentarios abiertos"
          count={openComments.length}
          accentClass="bg-sky-50/80"
          footer={
            <QuickAdd
              placeholder="Escribe un comentario sencillo…"
              submitLabel="Nuevo comentario"
              onSubmit={(text) => addComment(projectId, text)}
            />
          }
        >
          {openComments.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8 px-2">
              Sin comentarios abiertos.
            </p>
          ) : (
            openComments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                busy={busyId === comment.id}
                onResolve={() => void runBusy(comment.id, () => resolveComment(comment.id))}
              />
            ))
          )}
        </KanbanColumn>

        <KanbanColumn
          title="Comentarios cerrados"
          count={closedComments.length}
          accentClass="bg-slate-100/90"
        >
          {closedComments.length === 0 ? (
            <div className="text-center py-8 px-2 space-y-2">
              <Circle size={18} className="mx-auto text-slate-300" />
              <p className="text-xs text-slate-400">
                Los comentarios resueltos aparecerán aquí.
              </p>
            </div>
          ) : (
            closedComments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))
          )}
        </KanbanColumn>
      </div>
    </div>
  );
};

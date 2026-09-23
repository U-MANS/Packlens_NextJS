import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, FolderKanban, X } from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore';
import { formatDate } from '../../utils/dates';

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return formatDate(iso);
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const navigate = useNavigate();
  const { items, isLoading, fetchNotifications, markAllRead } = useNotificationStore();

  useEffect(() => {
    if (!open) return;
    void fetchNotifications();
    void markAllRead();
  }, [open, fetchNotifications, markAllRead]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleOpenProject = (projectId: string | null) => {
    if (!projectId) return;
    onClose();
    navigate(`/projects/${projectId}`);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Cerrar notificaciones"
        onClick={onClose}
      />
      <aside className="relative w-full max-w-md h-full bg-surface border-l border-border shadow-xl flex flex-col">
        <header className="h-16 px-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-accent" />
            <h2 className="font-semibold text-primary">Notificaciones</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-primary rounded-md hover:bg-slate-100 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {isLoading && items.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Cargando…</p>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <Bell size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No tienes notificaciones todavía.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenProject(n.project_id)}
                    disabled={!n.project_id}
                    className={`w-full text-left px-5 py-4 transition-colors hover:bg-slate-50 ${
                      !n.is_read ? 'bg-accent/5' : ''
                    } ${n.project_id ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                          n.is_read ? 'bg-transparent' : 'bg-accent'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary leading-snug">{n.title}</p>
                        {n.body && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.body}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                          <span>{formatWhen(n.created_at)}</span>
                          {n.project_id && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 text-accent">
                                <FolderKanban size={12} />
                                Ver proyecto
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

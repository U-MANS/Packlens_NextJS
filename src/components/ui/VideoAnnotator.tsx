'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crosshair, Loader2, Pause, Play, Trash2, X } from 'lucide-react';

import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { DesignProposal, ProjectAttachment } from '../../types';
import { toast } from '../ui/Toast';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/dates';

interface VideoAnnotatorProps {
  open: boolean;
  attachment: ProjectAttachment;
  proposal: DesignProposal;
  projectId: string;
  readOnly?: boolean;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const VideoAnnotator: React.FC<VideoAnnotatorProps> = ({
  open,
  attachment,
  proposal,
  projectId,
  readOnly = false,
  onClose,
}) => {
  const { imageAnnotations, addImageAnnotation, deleteImageAnnotation } = useAppStore();
  const userName = useAuthStore((s) => s.user?.name) ?? 'Tú';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number; timeMs: number } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const annotations = useMemo(
    () =>
      imageAnnotations
        .filter((a) => a.attachmentId === attachment.id && a.proposalId === proposal.id)
        .sort((a, b) => (a.page ?? 0) - (b.page ?? 0)),
    [imageAnnotations, attachment.id, proposal.id],
  );

  useEffect(() => {
    if (!open) {
      setPlaying(false);
      setPinMode(false);
      setPendingPos(null);
      setDraftText('');
    }
  }, [open]);

  if (!open) return null;

  const videoUrl = attachment.dataUrl || attachment.downloadUrl || '';

  const onVideoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !pinMode || !stageRef.current || !videoRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    videoRef.current.pause();
    setPlaying(false);
    setPendingPos({
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      timeMs: Math.round(videoRef.current.currentTime * 1000),
    });
  };

  const seekTo = (timeMs: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = timeMs / 1000;
    setCurrentTime(timeMs / 1000);
  };

  const saveAnnotation = async () => {
    const text = draftText.trim();
    if (!text || !pendingPos) return;
    setSaving(true);
    try {
      await addImageAnnotation({
        projectId,
        proposalId: proposal.id,
        attachmentId: attachment.id,
        text,
        position: { x: pendingPos.x, y: pendingPos.y },
        page: pendingPos.timeMs,
      });
      setDraftText('');
      setPendingPos(null);
      setPinMode(false);
      toast.success('Comentario añadido');
    } catch (err) {
      toast.error(getErrorMessage(err, 'No se pudo guardar el comentario'));
    } finally {
      setSaving(false);
    }
  };

  const visiblePins = annotations.filter((a) => {
    if (a.position == null || a.page == null) return false;
    const t = (a.page ?? 0) / 1000;
    return Math.abs(t - currentTime) < 0.35;
  });

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh]">
        <header className="h-14 px-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-primary truncate">{attachment.fileName}</h2>
            <p className="text-xs text-slate-500 truncate">
              {proposal.name} · {proposal.version}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-primary rounded-md hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_280px]">
          <div className="p-4 flex flex-col gap-3 min-h-0">
            <div
              ref={stageRef}
              className={`relative bg-black rounded-lg overflow-hidden aspect-video ${
                pinMode && !readOnly ? 'cursor-crosshair' : ''
              }`}
              onClick={onVideoClick}
            >
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
              {visiblePins.map((a) =>
                a.position ? (
                  <span
                    key={a.id}
                    className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-accent border-2 border-white shadow"
                    style={{
                      left: `${a.position.x * 100}%`,
                      top: `${a.position.y * 100}%`,
                    }}
                    title={a.text}
                  />
                ) : null,
              )}
              {pendingPos && (
                <span
                  className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-amber-400 border-2 border-white shadow animate-pulse"
                  style={{
                    left: `${pendingPos.x * 100}%`,
                    top: `${pendingPos.y * 100}%`,
                  }}
                />
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const el = videoRef.current;
                  if (!el) return;
                  if (el.paused) void el.play();
                  else el.pause();
                }}
                className="p-2 rounded-md border border-border text-slate-600 hover:bg-slate-50"
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.01}
                value={currentTime}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  seekTo(t * 1000);
                }}
                className="flex-1 accent-accent"
              />
              <span className="text-xs font-mono text-slate-500 tabular-nums w-20 text-right">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPinMode((v) => !v);
                    setPendingPos(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    pinMode
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-slate-600 hover:border-accent'
                  }`}
                >
                  <Crosshair size={14} />
                  {pinMode ? 'Haz clic en el fotograma…' : 'Señalar instante'}
                </button>
                {pendingPos && (
                  <span className="text-xs text-slate-500">
                    Pin en {formatTime(pendingPos.timeMs / 1000)}
                  </span>
                )}
              </div>
            )}

            {!readOnly && pendingPos && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="Escribe el comentario para este instante…"
                  className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveAnnotation();
                  }}
                />
                <button
                  type="button"
                  disabled={saving || !draftText.trim()}
                  onClick={() => void saveAnnotation()}
                  className="px-3 py-2 rounded-md bg-accent text-white text-sm font-medium disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Guardar'}
                </button>
              </div>
            )}
          </div>

          <aside className="border-t lg:border-t-0 lg:border-l border-border overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Comentarios ({annotations.length})
            </p>
            {annotations.length === 0 ? (
              <p className="text-xs text-slate-400">
                Aún no hay comentarios en este vídeo.
              </p>
            ) : (
              <ul className="space-y-2">
                {annotations.map((a) => (
                  <li
                    key={a.id}
                    className="bg-white border border-border rounded-lg p-2.5 text-sm"
                  >
                    <button
                      type="button"
                      className="text-left w-full"
                      onClick={() => seekTo(a.page ?? 0)}
                    >
                      <p className="text-[11px] font-mono text-accent mb-0.5">
                        {formatTime((a.page ?? 0) / 1000)}
                        {a.position ? ' · con pin' : ''}
                      </p>
                      <p className="text-primary leading-snug">{a.text}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {a.author || userName} · {formatDateTime(a.createdAt)}
                      </p>
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500"
                        onClick={() => void deleteImageAnnotation(a.id)}
                      >
                        <Trash2 size={12} /> Eliminar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
};

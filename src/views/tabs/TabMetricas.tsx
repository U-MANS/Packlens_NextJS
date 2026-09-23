import { useMemo } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  FileText,
  MessageCircle,
  Paperclip,
  Pin,
  RefreshCw,
  TrendingUp,
  XCircle,
} from 'lucide-react';

import { useAppStore } from '../../store/useAppStore';
import { PHASE_ORDER } from '../../utils/phase';
import { formatDate } from '../../utils/dates';
import type { ProjectPhase } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_HOUR = 1000 * 60 * 60;

function humanDuration(ms: number): string {
  if (ms < MS_PER_HOUR) return `${Math.max(1, Math.round(ms / (1000 * 60)))} min`;
  if (ms < MS_PER_DAY) return `${Math.round(ms / MS_PER_HOUR)} h`;
  const days = Math.round(ms / MS_PER_DAY);
  return `${days} día${days !== 1 ? 's' : ''}`;
}

// ─── Phase colours ────────────────────────────────────────────────────────────

const PHASE_COLOR: Record<string, string> = {
  'Diseño': '#8b5cf6',
  'Aprobación Diseño': '#f59e0b',
  'Creación Desarrollo': '#3b82f6',
  'Validación diseño': '#f97316',
  'Aprobación Legal': '#ef4444',
  'Arte final': '#10b981',
  'Aprobación final': '#059669',
  'Aprobado': '#065f46',
};

const phaseColor = (phase: string) => PHASE_COLOR[phase] ?? '#94a3b8';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhaseInterval {
  phase: ProjectPhase;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number;
  isActive: boolean;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}> = ({ icon, label, value, sub, color = 'text-slate-600' }) => (
  <div className="bg-surface border border-border rounded-xl p-5 flex items-start gap-4 shadow-sm">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 ${color}`}>
      {icon}
    </div>
    <div className="min-w-0 overflow-hidden">
      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1 truncate">{label}</p>
      <p className="text-2xl font-bold text-primary leading-none truncate">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1 truncate">{sub}</p>}
    </div>
  </div>
);

// ─── Gantt bar chart ─────────────────────────────────────────────────────────

const GanttChart: React.FC<{ intervals: PhaseInterval[]; totalMs: number }> = ({
  intervals,
  totalMs,
}) => {
  if (totalMs === 0) return null;

  return (
    <div className="space-y-3">
      {PHASE_ORDER.map((phase) => {
        const interval = intervals.find((i) => i.phase === phase);
        const color = phaseColor(phase);
        const pct = interval ? (interval.durationMs / totalMs) * 100 : 0;
        const offsetPct = interval
          ? ((interval.startedAt.getTime() - intervals[0].startedAt.getTime()) / totalMs) * 100
          : 0;

        return (
          <div key={phase} className="flex items-center gap-3">
            {/* Phase label */}
            <div className="w-40 shrink-0 text-right">
              <span className="text-xs font-medium text-slate-600 truncate block">{phase}</span>
            </div>

            {/* Track */}
            <div className="flex-1 h-8 bg-slate-100 rounded-md relative overflow-hidden">
              {interval ? (
                <div
                  className="absolute top-0 h-full rounded-md flex items-center px-2 overflow-hidden transition-all"
                  style={{
                    left: `${offsetPct}%`,
                    width: `${Math.max(pct, 1)}%`,
                    backgroundColor: color,
                    opacity: interval.isActive ? 1 : 0.85,
                  }}
                >
                  {pct > 8 && (
                    <span className="text-white text-[11px] font-semibold truncate whitespace-nowrap">
                      {humanDuration(interval.durationMs)}
                    </span>
                  )}
                  {interval.isActive && (
                    <span className="ml-1 w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                  )}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center pl-3">
                  <span className="text-xs text-slate-300">Pendiente</span>
                </div>
              )}
            </div>

            {/* Duration label */}
            <div className="w-20 shrink-0">
              {interval ? (
                <span className={`text-xs font-medium ${interval.isActive ? 'text-accent' : 'text-slate-500'}`}>
                  {interval.isActive ? '⏳ ' : ''}{humanDuration(interval.durationMs)}
                </span>
              ) : (
                <span className="text-xs text-slate-300">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Phase table ─────────────────────────────────────────────────────────────

const PhaseTable: React.FC<{
  intervals: PhaseInterval[];
  actions: ReturnType<typeof useAppStore.getState>['phaseActions'];
  projectId: string;
}> = ({ intervals, actions, projectId }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Fase</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Inicio</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Fin</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Duración</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">✅ Apr</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">❌ Rec</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</th>
          </tr>
        </thead>
        <tbody>
          {PHASE_ORDER.map((phase) => {
            const interval = intervals.find((i) => i.phase === phase);
            const phaseActions = actions.filter((a) => a.projectId === projectId && a.phase === phase);
            const approvals = phaseActions.filter((a) => a.type === 'approve').length;
            const rejections = phaseActions.filter((a) => a.type === 'reject').length;
            const color = phaseColor(phase);

            return (
              <tr key={phase} className="border-b border-border/60 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-medium text-primary text-sm">{phase}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {interval ? formatDate(interval.startedAt.toISOString()) : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {interval?.endedAt ? formatDate(interval.endedAt.toISOString()) : interval ? '—' : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {interval ? (
                    <span className="text-xs font-medium text-slate-700">
                      {humanDuration(interval.durationMs)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-xs font-medium text-emerald-700">
                  {approvals || '—'}
                </td>
                <td className="px-4 py-3 text-right text-xs font-medium text-red-600">
                  {rejections || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {interval?.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Activa
                    </span>
                  ) : interval ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                      <CheckCircle2 size={10} /> Completada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-xs font-medium">
                      Pendiente
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Mini bar (inline) ────────────────────────────────────────────────────────

const MiniBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: color }}
      />
    </div>
    <span className="text-xs font-semibold text-slate-700 w-6 text-right">{value}</span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const TabMetricas = ({ projectId }: { projectId: string }) => {
  const {
    projects,
    activity,
    phaseActions,
    designProposals,
    arteFinals,
    imageAnnotations,
    reviewRefAttachments,
  } = useAppStore();

  const project = projects.find((p) => p.id === projectId);

  // ── Build phase intervals from activity events ────────────────────────────
  const intervals = useMemo<PhaseInterval[]>(() => {
    if (!project) return [];

    const now = new Date();

    // Collect all PHASE_CHANGED events for this project, sorted ascending
    const phaseEvents = activity
      .filter((e) => e.projectId === projectId && e.type === 'PHASE_CHANGED')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    // Extract phase from text like: Fase cambiada a "Aprobación Diseño"
    const parsePhase = (text: string): ProjectPhase | null => {
      const m = text.match(/Fase cambiada a "([^"]+)"/);
      if (!m) return null;
      const p = m[1] as ProjectPhase;
      return PHASE_ORDER.includes(p) ? p : null;
    };

    // Build a timeline: [[date, phase]]
    // Start: project.createdAt → 'Diseño'
    const timeline: { ts: Date; phase: ProjectPhase }[] = [
      { ts: new Date(project.createdAt), phase: 'Diseño' },
    ];

    phaseEvents.forEach((e) => {
      const p = parsePhase(e.text);
      if (p) timeline.push({ ts: new Date(e.createdAt), phase: p });
    });

    // Deduplicate keeping last occurrence per phase
    const seen = new Map<ProjectPhase, number>();
    timeline.forEach((t, i) => seen.set(t.phase, i));

    return timeline
      .filter((t, i) => seen.get(t.phase) === i)
      .map((t, i, arr) => {
        const nextTs = arr[i + 1]?.ts ?? now;
        const isLast = i === arr.length - 1;
        const isActive = isLast && project.phase === t.phase;
        const durationMs = nextTs.getTime() - t.ts.getTime();
        return {
          phase: t.phase,
          startedAt: t.ts,
          endedAt: isActive ? null : nextTs,
          durationMs: Math.max(0, durationMs),
          isActive,
        };
      });
  }, [project, activity, projectId]);

  const totalMs = useMemo(
    () => intervals.reduce((s, i) => s + i.durationMs, 0),
    [intervals],
  );

  // ── Counts ────────────────────────────────────────────────────────────────
  const projectActions = useMemo(
    () => phaseActions.filter((a) => a.projectId === projectId),
    [phaseActions, projectId],
  );
  const totalApprovals = projectActions.filter((a) => a.type === 'approve').length;
  const totalRejections = projectActions.filter((a) => a.type === 'reject').length;
  const totalComments = projectActions.filter((a) => a.type === 'comment').length;

  const proposals = useMemo(
    () => designProposals.filter((d) => d.projectId === projectId),
    [designProposals, projectId],
  );
  const proposalFiles = proposals.reduce((s, p) => s + p.attachments.length, 0);
  const arteFinalCount = arteFinals.filter((a) => a.projectId === projectId).length;
  const refFiles = reviewRefAttachments.filter((r) => r.projectId === projectId).length;
  const briefFiles =
    (project?.briefing?.files?.length ?? 0) + (project?.briefing?.fileName ? 1 : 0);

  const totalFiles = proposalFiles + arteFinalCount + refFiles + briefFiles;
  const totalAnnotations = imageAnnotations.filter((a) => a.projectId === projectId).length;

  // ── Actions per phase (for breakdown chart) ───────────────────────────────
  const actionsPerPhase = useMemo(() => {
    return PHASE_ORDER.map((phase) => {
      const pa = projectActions.filter((a) => a.phase === phase);
      return {
        phase,
        approvals: pa.filter((a) => a.type === 'approve').length,
        rejections: pa.filter((a) => a.type === 'reject').length,
        comments: pa.filter((a) => a.type === 'comment').length,
      };
    }).filter((r) => r.approvals + r.rejections + r.comments > 0);
  }, [projectActions]);

  const maxActions = useMemo(
    () => Math.max(1, ...actionsPerPhase.map((r) => r.approvals + r.rejections + r.comments)),
    [actionsPerPhase],
  );

  if (!project) return null;

  const elapsedDays = Math.max(
    1,
    Math.round((Date.now() - new Date(project.createdAt).getTime()) / MS_PER_DAY),
  );

  return (
    <div className="space-y-8 pb-6">

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<Clock size={18} />}
          label="Días en curso"
          value={elapsedDays}
          sub={`Desde ${formatDate(project.createdAt)}`}
          color="text-accent"
        />
        <StatCard
          icon={<Paperclip size={18} />}
          label="Archivos"
          value={totalFiles}
          sub={`${proposalFiles} prop. · ${briefFiles} brief.`}
          color="text-purple-600"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Aprobaciones"
          value={totalApprovals}
          sub="acciones de aprobación"
          color="text-emerald-600"
        />
        <StatCard
          icon={<XCircle size={18} />}
          label="Rechazos"
          value={totalRejections}
          sub="revisiones devueltas"
          color="text-red-500"
        />
        <StatCard
          icon={<MessageCircle size={18} />}
          label="Comentarios"
          value={totalComments}
          sub="en revisiones de fase"
          color="text-blue-500"
        />
        <StatCard
          icon={<Pin size={18} />}
          label="Anotaciones"
          value={totalAnnotations}
          sub="pines sobre imagen"
          color="text-amber-500"
        />
      </div>

      {/* ── Secondary stats row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={14} className="text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Propuestas</span>
          </div>
          <p className="text-2xl font-bold text-primary">{proposals.length}</p>
          <p className="text-xs text-slate-400 mt-1">{proposalFiles} archivo{proposalFiles !== 1 ? 's' : ''} adjunto{proposalFiles !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Archive size={14} className="text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Arte final</span>
          </div>
          <p className="text-2xl font-bold text-primary">{arteFinalCount}</p>
          <p className="text-xs text-slate-400 mt-1">versione{arteFinalCount !== 1 ? 's' : ''} subida{arteFinalCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Paperclip size={14} className="text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Referencias</span>
          </div>
          <p className="text-2xl font-bold text-primary">{refFiles}</p>
          <p className="text-xs text-slate-400 mt-1">archivos de referencia</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={14} className="text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Eficiencia</span>
          </div>
          <p className="text-2xl font-bold text-primary">
            {totalRejections + totalApprovals > 0
              ? `${Math.round((totalApprovals / (totalApprovals + totalRejections)) * 100)}%`
              : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">tasa de aprobación</p>
        </div>
      </div>

      {/* ── Phase timeline chart ─────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <TrendingUp size={15} className="text-accent" /> Línea de tiempo por fase
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Duración acumulada en cada fase · Total: {humanDuration(totalMs)}
            </p>
          </div>
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-4 flex-wrap">
            {PHASE_ORDER.slice(0, 3).map((p) => (
              <div key={p} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: phaseColor(p) }} />
                {p}
              </div>
            ))}
          </div>
        </div>
        <div className="p-6">
          {intervals.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Sin datos de fases todavía.</p>
          ) : (
            <GanttChart intervals={intervals} totalMs={totalMs} />
          )}
        </div>
      </div>

      {/* ── Phase detail table ───────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <Clock size={15} className="text-accent" /> Detalle por fase
          </h3>
        </div>
        <PhaseTable
          intervals={intervals}
          actions={phaseActions}
          projectId={projectId}
        />
      </div>

      {/* ── Activity breakdown ───────────────────────────────────────────── */}
      {actionsPerPhase.length > 0 && (
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <AlertCircle size={15} className="text-accent" /> Actividad de revisión por fase
            </h3>
          </div>
          <div className="p-6 space-y-5">
            {actionsPerPhase.map(({ phase, approvals, rejections, comments }) => {
              const total = approvals + rejections + comments;
              const color = phaseColor(phase);
              return (
                <div key={phase}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium text-primary">{phase}</span>
                    </div>
                    <span className="text-xs text-slate-400">{total} acción{total !== 1 ? 'es' : ''}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-1">Aprobaciones</p>
                      <MiniBar value={approvals} max={maxActions} color="#10b981" />
                    </div>
                    <div>
                      <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-1">Rechazos</p>
                      <MiniBar value={rejections} max={maxActions} color="#ef4444" />
                    </div>
                    <div>
                      <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide mb-1">Comentarios</p>
                      <MiniBar value={comments} max={maxActions} color="#3b82f6" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Project info footer ──────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
          <FileText size={15} className="text-accent" /> Resumen del proyecto
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 text-sm">
          {[
            { label: 'Creado', value: formatDate(project.createdAt) },
            { label: 'Fase actual', value: project.phase },
            { label: 'Estado', value: project.status },
            { label: 'Versión', value: `v${project.version}` },
            { label: 'Responsable', value: project.owner || '—' },
            { label: 'Resp. diseño', value: project.designLead || '—' },
            { label: 'Lanzamiento', value: project.launchDate ? formatDate(project.launchDate) : '—' },
            { label: 'Límite arte', value: project.artDeadline ? formatDate(project.artDeadline) : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-0.5">{label}</p>
              <p className="text-primary font-medium truncate">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

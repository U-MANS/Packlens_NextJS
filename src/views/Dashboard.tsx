import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { FolderKanban, CheckCircle2, AlertCircle, Clock, Plus } from 'lucide-react';
import { PHASE_ORDER, isPhaseOwnedByRole } from '../utils/phase';
import { filterProjectsForRole, isComercialView } from '../utils/roles';
import { formatDate } from '../utils/dates';

const PHASE_COLORS: Record<string, string> = {
  'Diseño': '#8b5cf6',
  'Aprobación Diseño': '#f59e0b',
  'Creación Desarrollo': '#3b82f6',
  'Validación diseño': '#f97316',
  'Aprobación Legal': '#ef4444',
  'Arte final': '#10b981',
  'Aprobación final': '#059669',
  'Aprobado': '#065f46',
};

const PipelineBar = ({ phase }: { phase: string }) => {
  const idx = PHASE_ORDER.indexOf(phase as never);
  const total = PHASE_ORDER.length - 1;
  const pct = idx < 0 ? 0 : Math.round((idx / total) * 100);
  const color = PHASE_COLORS[phase] ?? '#94a3b8';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] text-slate-500 w-8 text-right shrink-0">{pct}%</span>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { projects, activity, activeRole } = useAppStore();

  const activeProjects = useMemo(
    () => filterProjectsForRole(projects, activeRole),
    [projects, activeRole],
  );
  const isComercial = isComercialView(activeRole);

  const awaitingMyAction = useMemo(
    () =>
      activeProjects.filter(
        (p) => p.phase !== 'Aprobado' && isPhaseOwnedByRole(activeRole, p.phase),
      ),
    [activeProjects, activeRole],
  );

  const recentlyRejected = useMemo(
    () => activeProjects.filter((p) => p.status === 'Cambios solicitados'),
    [activeProjects],
  );

  const stats = [
    {
      title: 'Proyectos Activos',
      value: activeProjects.length,
      icon: FolderKanban,
      color: 'text-blue-500',
      bg: 'bg-blue-100',
      onClick: () => navigate('/projects'),
    },
    {
      title: 'Tareas Pendientes',
      value: awaitingMyAction.length,
      icon: CheckCircle2,
      color: 'text-amber-500',
      bg: 'bg-amber-100',
      onClick: () => navigate('/projects?awaitingMe=1'),
    },
    {
      title: 'Rechazados recientemente',
      value: recentlyRejected.length,
      icon: AlertCircle,
      color: 'text-red-500',
      bg: 'bg-red-100',
      onClick: () => navigate('/projects?rejected=1'),
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            {isComercial
              ? 'Consulta los productos vigentes en mercado.'
              : 'Visión general del estado de tus proyectos de packaging.'}
          </p>
        </div>
        {!isComercial && (
          <button
            onClick={() => navigate('/projects/new')}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md font-medium transition-colors text-sm self-start sm:self-auto"
          >
            <Plus size={18} />
            Nuevo proyecto
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={stat.onClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                stat.onClick();
              }
            }}
            className="cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Card className="hover:border-accent/40 hover:shadow-md transition-all h-full">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-primary">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Proyectos en curso</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">Progreso de cada proyecto en el pipeline</p>
              </div>
              <button
                onClick={() => navigate('/projects')}
                className="text-sm font-medium text-accent hover:text-accent-hover transition-colors"
              >
                Ver todos
              </button>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">Proyecto</th>
                    <th className="px-6 py-4 font-medium">Mercado</th>
                    <th className="px-6 py-4 font-medium">Estado</th>
                    <th className="px-6 py-4 font-medium w-36">Progreso</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.slice(0, 6).map((project) => (
                    <tr
                      key={project.id}
                      className="border-b border-border hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <td className="px-6 py-4 font-medium text-primary">
                        {project.name}
                        <div className="text-xs text-slate-400 font-normal mt-0.5">{project.sku}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                            {project.language}
                          </span>
                          {project.market}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="px-6 py-4">
                        <PipelineBar phase={project.phase} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {activity
                  .slice()
                  .reverse()
                  .slice(0, 6)
                  .map((act) => (
                    <div key={act.id} className="p-4 flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
                        <Clock size={13} />
                      </div>
                      <div>
                        <p className="text-sm text-primary font-medium leading-snug">{act.text}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {act.actor} · {formatDate(act.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

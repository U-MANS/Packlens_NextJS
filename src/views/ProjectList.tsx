import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  Filter,
  GitBranchPlus,
  Image as ImageIcon,
  MoreHorizontal,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

import { Card, CardHeader } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { useAppStore } from '../store/useAppStore';
import type { LifecycleStatus, Project } from '../types';
import { isPhaseOwnedByRole, phasesOwnedByRole } from '../utils/phase';
import { filterProjectsForRole, isComercialView } from '../utils/roles';
import { formatDate } from '../utils/dates';

// ─── Lifecycle badge ──────────────────────────────────────────────────────────

const LIFECYCLE_STYLES: Record<LifecycleStatus, string> = {
  Borrador:       'bg-slate-100 text-slate-600 border-slate-200',
  'Pendiente SAP':'bg-amber-50 text-amber-700 border-amber-200',
  Vigente:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  Temporal:       'bg-blue-50 text-blue-700 border-blue-200',
  Obsoleta:       'bg-red-50 text-red-600 border-red-200',
};

const LifecycleBadge = ({ status }: { status: LifecycleStatus | undefined }) => {
  const s = status ?? 'Borrador';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${LIFECYCLE_STYLES[s]}`}>
      {s}
    </span>
  );
};

// ─── Version badge ────────────────────────────────────────────────────────────

const VersionBadge = ({ version }: { version: number }) => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-500 border border-slate-200 ml-1.5">
    v{version}
  </span>
);

// ─── Context menu ─────────────────────────────────────────────────────────────

interface RowMenuProps {
  project: Project;
  anchorEl: HTMLButtonElement | null;
  onClose: () => void;
  onView: () => void;
  onNewVersion: () => void;
  onDiscontinue: () => void;
  onDelete: () => void;
}

const RowMenu: React.FC<RowMenuProps> = ({
  project,
  anchorEl,
  onClose,
  onView,
  onNewVersion,
  onDiscontinue,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!anchorEl || !menuRef.current) return;
    const rect = anchorEl.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const gap = 8;
    let top = rect.bottom + gap;
    if (top + menuRect.height > window.innerHeight - gap) {
      top = rect.top - menuRect.height - gap;
    }
    const left = Math.min(
      Math.max(8, rect.right - menuRect.width),
      window.innerWidth - menuRect.width - 8,
    );
    setStyle({ position: 'fixed', top, left, zIndex: 9999 });
  }, [anchorEl]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorEl]);

  const item = (
    icon: React.ReactNode,
    label: string,
    action: () => void,
    danger = false,
  ) => (
    <button
      type="button"
      onClick={() => { action(); onClose(); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors text-left ${
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="w-56 bg-white border border-border rounded-xl shadow-lg py-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {item(<Eye size={15} className="text-slate-400" />, 'Ver proyecto', onView)}
      <div className="border-t border-border my-1" />
      {item(
        <GitBranchPlus size={15} className="text-blue-500" />,
        `Crear versión v${(project.version ?? 1) + 1}`,
        onNewVersion,
      )}
      <div className="border-t border-border my-1" />
      {item(
        <Tag size={15} className="text-amber-500" />,
        'Marcar como descatalogado',
        onDiscontinue,
      )}
      {item(<Trash2 size={15} />, 'Eliminar proyecto', onDelete, true)}
    </div>,
    document.body,
  );
};

// ─── Row ─────────────────────────────────────────────────────────────────────

interface ProjectRowProps {
  project: Project;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}

const ProjectRow: React.FC<ProjectRowProps> = ({ project, openMenuId, setOpenMenuId }) => {
  const navigate = useNavigate();
  const { deleteProject, markDiscontinued } = useAppStore();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const [thumbHover, setThumbHover] = useState(false);
  const [thumbPos, setThumbPos] = useState<{ top: number; left: number } | null>(null);

  const menuOpen = openMenuId === project.id;

  const marketCodes =
    project.markets && project.markets.length > 0
      ? project.markets
      : [project.language];
  const targetIso = project.launchDate ?? project.targetDate;

  useLayoutEffect(() => {
    if (!thumbHover || !thumbRef.current) {
      setThumbPos(null);
      return;
    }
    const rect = thumbRef.current.getBoundingClientRect();
    setThumbPos({ top: rect.bottom + 6, left: rect.left });
  }, [thumbHover]);

  return (
    <tr
      className="group border-b border-border hover:bg-slate-50 cursor-pointer transition-colors"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <td className="px-6 py-4 font-medium text-primary">
        <div className="flex items-center gap-1.5">
          <span className={project.discontinued ? 'line-through text-slate-400' : ''}>{project.name}</span>
          <VersionBadge version={project.version ?? 1} />
          {project.thumbnail?.dataUrl && (
            <span
              ref={thumbRef}
              className="inline-flex items-center justify-center text-slate-400 hover:text-accent transition-colors"
              title="Thumbnail"
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setThumbHover(true)}
              onMouseLeave={() => setThumbHover(false)}
            >
              <ImageIcon size={14} />
            </span>
          )}
          {project.discontinued && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
              Descatalogado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-400 font-mono">{project.sku}</span>
          {project.previousVersionId && (
            <span className="text-[10px] text-blue-500 font-medium">
              ↳ nueva versión
            </span>
          )}
        </div>
        {thumbHover && thumbPos && project.thumbnail?.dataUrl &&
          createPortal(
            <div
              className="fixed z-[80] pointer-events-none"
              style={{ top: thumbPos.top, left: thumbPos.left }}
            >
              <div className="rounded-lg border border-border bg-white shadow-xl p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={project.thumbnail.dataUrl}
                  alt={`Thumbnail de ${project.name}`}
                  className="w-36 h-36 object-cover rounded-md"
                />
              </div>
            </div>,
            document.body,
          )}
      </td>
      <td className="px-6 py-4 text-slate-600">
        {project.productLine || project.format ? (
          <>
            <div className="text-slate-700">{project.productLine ?? '—'}</div>
            {project.format && (
              <div className="text-xs text-slate-400 mt-0.5">{project.format}</div>
            )}
          </>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-wrap gap-1">
          {marketCodes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono font-semibold"
            >
              {code}
            </span>
          ))}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1.5">
          <StatusBadge status={project.status} />
          <LifecycleBadge status={project.lifecycleStatus} />
        </div>
      </td>
      <td className="px-6 py-4 text-slate-600">{project.owner}</td>
      <td className="px-6 py-4 text-slate-600">
        {formatDate(targetIso)}
      </td>
      {/* Actions cell */}
      <td className="px-4 py-4 w-12" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex justify-end">
          <button
            ref={btnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(menuOpen ? null : project.id);
            }}
            className={`p-1.5 rounded-md transition-colors ${
              menuOpen
                ? 'bg-slate-200 text-slate-700'
                : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700'
            }`}
            title="Opciones"
          >
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <RowMenu
              project={project}
              anchorEl={btnRef.current}
              onClose={() => setOpenMenuId(null)}
              onView={() => navigate(`/projects/${project.id}`)}
              onNewVersion={() => navigate(`/projects/new?from=${project.id}`)}
              onDiscontinue={() => void markDiscontinued(project.id)}
              onDelete={() => void deleteProject(project.id)}
            />
          )}
        </div>
      </td>
    </tr>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ProjectList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, activeRole } = useAppStore();
  const isComercial = isComercialView(activeRole);
  const awaitingMe = searchParams.get('awaitingMe') === '1';
  const rejectedFilter = searchParams.get('rejected') === '1';
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(
    rejectedFilter ? 'Cambios solicitados' : 'Todos',
  );
  const [filterLifecycle, setFilterLifecycle] = useState<LifecycleStatus | 'Todos'>(
    isComercial ? 'Vigente' : 'Todos',
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close menu when clicking anywhere outside a row
  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [openMenuId]);

  useEffect(() => {
    if (isComercial) setFilterLifecycle('Vigente');
  }, [isComercial]);

  useEffect(() => {
    if (rejectedFilter) setFilterStatus('Cambios solicitados');
  }, [rejectedFilter]);

  const myPhases = useMemo(() => phasesOwnedByRole(activeRole), [activeRole]);

  const visibleProjects = useMemo(
    () => filterProjectsForRole(projects, activeRole),
    [projects, activeRole],
  );

  const filteredProjects = visibleProjects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'Todos' || p.status === filterStatus;
    const matchesLifecycle =
      filterLifecycle === 'Todos' || (p.lifecycleStatus ?? 'Borrador') === filterLifecycle;
    const matchesAwaitingMe =
      !awaitingMe || (p.phase !== 'Aprobado' && isPhaseOwnedByRole(activeRole, p.phase));
    const matchesRejected = !rejectedFilter || p.status === 'Cambios solicitados';
    return (
      matchesSearch &&
      matchesStatus &&
      matchesLifecycle &&
      matchesAwaitingMe &&
      matchesRejected
    );
  });

  const clearSpecialFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('awaitingMe');
    next.delete('rejected');
    setSearchParams(next, { replace: true });
    if (rejectedFilter) setFilterStatus('Todos');
  };

  const statuses = [
    'Todos',
    'En diseño',
    'En aprobación diseño',
    'En creación desarrollo',
    'En validación diseño',
    'En aprobación legal',
    'En arte final',
    'En aprobación final',
    'Aprobado',
    'Cambios solicitados',
    'Rechazado',
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Proyectos</h1>
          <p className="text-slate-500 mt-1">
            {isComercial
              ? 'Consulta los productos vigentes en mercado.'
              : rejectedFilter
                ? 'Proyectos rechazados pendientes de cambios.'
                : awaitingMe
                  ? 'Proyectos en una fase que depende de tu rol.'
                  : 'Gestiona todos los proyectos de packaging activos.'}
          </p>
        </div>
        {!isComercial && (
          <button
            onClick={() => navigate('/projects/new')}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            <Plus size={18} />
            Nuevo Proyecto
          </button>
        )}
      </div>

      {awaitingMe && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900">Pendientes de tu acción</p>
            <p className="text-xs text-amber-800/80 mt-0.5">
              Filtrado por fases de {activeRole}
              {myPhases.length > 0 ? `: ${myPhases.join(', ')}` : ''}.
            </p>
          </div>
          <button
            type="button"
            onClick={clearSpecialFilters}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs font-medium text-amber-900 hover:text-amber-950 px-2.5 py-1.5 rounded-md border border-amber-300 bg-white/70 hover:bg-white transition-colors"
          >
            <X size={13} /> Quitar filtro
          </button>
        </div>
      )}

      {rejectedFilter && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-900">Rechazados recientemente</p>
            <p className="text-xs text-red-800/80 mt-0.5">
              Proyectos con estado «Cambios solicitados» tras un rechazo.
            </p>
          </div>
          <button
            type="button"
            onClick={clearSpecialFilters}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs font-medium text-red-900 hover:text-red-950 px-2.5 py-1.5 rounded-md border border-red-300 bg-white/70 hover:bg-white transition-colors"
          >
            <X size={13} /> Quitar filtro
          </button>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-4 border-b border-border bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre o código de artículo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-slate-400 shrink-0" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {!isComercial && (
              <select
                value={filterLifecycle}
                onChange={(e) => setFilterLifecycle(e.target.value as LifecycleStatus | 'Todos')}
                className="border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent"
              >
                <option value="Todos">Todos los ciclos</option>
                {(['Borrador', 'Pendiente SAP', 'Vigente', 'Temporal', 'Obsoleta'] as LifecycleStatus[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium">Proyecto</th>
                <th className="px-6 py-4 font-medium">Gama / Formato</th>
                <th className="px-6 py-4 font-medium">Mercados</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium">Responsable</th>
                <th className="px-6 py-4 font-medium">Fecha Objetivo</th>
                <th className="px-4 py-4 w-12" />
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    {visibleProjects.length === 0
                      ? 'No hay proyectos activos todavía.'
                      : 'No se encontraron proyectos que coincidan con los filtros.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ProjectList;

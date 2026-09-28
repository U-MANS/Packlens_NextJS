import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { ArrowLeft, Edit3, Image as ImageIcon, Pencil, Upload, Hash } from 'lucide-react';

import { useAppStore } from '../store/useAppStore';
import { StatusBadge } from '../components/ui/Badge';
import { DateInput } from '../components/ui/DateInput';
import { UploadDesignModal } from '../components/modals/UploadDesignModal';
import {
  isDesignUploadPhase,
  isDesarrolloUploadPhase,
  isProposalInUploadGroup,
  suggestNextProposalVersion,
} from '../utils/phase';
import { isProjectVisibleToRole } from '../utils/roles';
import type { LifecycleStatus } from '../types';

// ─── Lifecycle badge (local, mirrors ProjectList) ─────────────────────────────

const LIFECYCLE_STYLES: Record<LifecycleStatus, string> = {
  Borrador:        'bg-slate-100 text-slate-600 border-slate-200',
  'Pendiente SAP': 'bg-amber-50 text-amber-700 border-amber-200',
  Vigente:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  Temporal:        'bg-blue-50 text-blue-700 border-blue-200',
  Obsoleta:        'bg-red-50 text-red-600 border-red-200',
};

const LifecycleBadge = ({ status }: { status: LifecycleStatus | undefined }) => {
  const s = status ?? 'Borrador';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${LIFECYCLE_STYLES[s]}`}>
      {s}
    </span>
  );
};

import { TabResumen } from './tabs/TabResumen';
import { TabDocumentos } from './tabs/TabDocumentos';
import { TabComparador } from './tabs/TabComparador';
import { TabTareas } from './tabs/TabTareas';
import { TabActividad } from './tabs/TabActividad';
import { TabMetricas } from './tabs/TabMetricas';

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, designProposals, updateProject, loadProjectDetail, activeRole } = useAppStore();
  const project = projects.find((p) => p.id === id);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sapModalOpen, setSapModalOpen] = useState(false);
  const [sapInput, setSapInput] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    briefingNotes: '',
    launchDate: '',
    artDeadline: '',
    designLead: '',
    regulatoryContact: '',
  });
  const projectProposals = useMemo(
    () => designProposals.filter((d) => d.projectId === id),
    [designProposals, id],
  );
  const suggestedVersion = useMemo(() => {
    const phase = project?.phase;
    if (!phase) return 'v1.0';
    const inGroup = projectProposals.filter((p) =>
      isProposalInUploadGroup(p.uploadedPhase, phase),
    );
    return suggestNextProposalVersion(inGroup.map((p) => p.version));
  }, [projectProposals, project?.phase]);
  const latestDesignProposal = useMemo(
    () =>
      [...projectProposals]
        .filter(
          (p) =>
            !p.uploadedPhase ||
            p.uploadedPhase === 'Diseño' ||
            p.uploadedPhase === 'Aprobación Diseño',
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [projectProposals],
  );

  const [detailLoading, setDetailLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setDetailLoading(true);
    void loadProjectDetail(id).finally(() => setDetailLoading(false));
  }, [id, loadProjectDetail]);

  if (detailLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project || !isProjectVisibleToRole(project, activeRole)) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">Proyecto no encontrado</h2>
        <button onClick={() => navigate('/projects')} className="text-accent hover:underline">
          Volver a proyectos
        </button>
      </div>
    );
  }

  const tabs = [
    { name: 'Resumen', path: '' },
    { name: 'Documentos', path: 'documents' },
    { name: 'Comparador', path: 'compare' },
    { name: 'Tareas', path: 'tasks' },
    { name: 'Actividad', path: 'activity' },
    { name: 'Métricas', path: 'metrics' },
  ];

  const baseUrl = `/projects/${project.id}`;
  const marketsLabel =
    project.markets && project.markets.length > 0
      ? project.markets.join(' · ')
      : `${project.market} (${project.language})`;

  const canShowDesignProposalUpload =
    (activeRole === 'Diseño' || activeRole === 'Admin') && isDesignUploadPhase(project.phase);
  const canShowDesarrolloUpload =
    (activeRole === 'Diseño' || activeRole === 'Admin') && isDesarrolloUploadPhase(project.phase);
  const canShowDesignUpload = canShowDesignProposalUpload || canShowDesarrolloUpload;
  const canEditProject = activeRole === 'Marketing' || activeRole === 'Admin';

  const openEditModal = () => {
    setEditForm({
      name: project.name,
      description: project.description ?? '',
      briefingNotes: project.briefing?.notes ?? '',
      launchDate: project.launchDate ?? project.targetDate ?? '',
      artDeadline: project.artDeadline ?? '',
      designLead: project.designLead ?? '',
      regulatoryContact: project.regulatoryContact ?? '',
    });
    setEditOpen(true);
  };

  const isAvFlow = project.flowType === 'Campaña audiovisual';
  const uploadLabel =
    project.phase === 'Creación Desarrollo'
      ? isAvFlow
        ? 'Subir audiovisual'
        : 'Subir archivo de desarrollo'
      : project.phase === 'Aprobación Diseño'
        ? 'Añadir archivos'
        : project.phase === 'Arte final' && isAvFlow
          ? 'Subir masters'
          : 'Subir propuesta de diseño';

  return (
    <div className="flex flex-col h-full">
      {/* Detail Header */}
      <div className="bg-surface border-b border-border px-8 pt-8 pb-0 shrink-0">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Volver a proyectos
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-primary">{project.name}</h1>
              <StatusBadge status={project.status} />
              <LifecycleBadge status={project.lifecycleStatus} />
            </div>
            <p className="text-slate-500 text-sm flex items-center flex-wrap gap-x-0">
              <span className="font-mono">{project.sku}</span>
              <span className="mx-2 text-slate-300">•</span>
              Mercados: {marketsLabel}
              <span className="mx-2 text-slate-300">•</span>
              Responsable: {project.owner}
              {project.regulatoryContact && (
                <>
                  <span className="mx-2 text-slate-300">•</span>
                  Regulatory: {project.regulatoryContact}
                </>
              )}
            </p>

            {/* SAP code row */}
            <div className="mt-2 flex items-center gap-2">
              {project.sapCode ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                  <Hash size={12} className="text-slate-400" />
                  {project.sapCode}
                  <button
                    type="button"
                    onClick={() => { setSapInput(project.sapCode ?? ''); setSapModalOpen(true); }}
                    className="ml-1 text-slate-400 hover:text-accent transition-colors"
                    title="Editar código SAP"
                  >
                    <Pencil size={11} />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => { setSapInput(''); setSapModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-accent border border-dashed border-slate-300 hover:border-accent/50 hover:bg-accent/5 px-2.5 py-1 rounded-md transition-colors"
                >
                  <Hash size={12} /> Asignar código SAP
                </button>
              )}

              {project.thumbnail?.dataUrl && (
                <div className="relative group/thumb">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 border border-slate-200 bg-white px-2 py-1 rounded-md cursor-default"
                    aria-label="Vista previa del thumbnail"
                  >
                    <ImageIcon size={12} className="text-slate-400" />
                    Thumbnail
                  </button>
                  <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 opacity-0 scale-95 group-hover/thumb:opacity-100 group-hover/thumb:scale-100 transition-all duration-150 origin-top-left">
                    <div className="rounded-lg border border-border bg-white shadow-xl p-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={project.thumbnail.dataUrl}
                        alt={`Thumbnail de ${project.name}`}
                        className="w-44 h-44 object-cover rounded-md"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {canShowDesignUpload && (
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-md font-semibold transition-colors text-sm shadow-sm"
              >
                <Upload size={16} />
                {uploadLabel}
              </button>
            )}
            {canEditProject && (
              <button
                type="button"
                onClick={openEditModal}
                className="flex items-center gap-2 bg-white border border-border hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium transition-colors text-sm"
              >
                <Edit3 size={16} /> Editar
              </button>
            )}
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex space-x-8">
          {tabs.map((tab) => (
            <NavLink
              key={tab.name}
              to={tab.path ? `${baseUrl}/${tab.path}` : baseUrl}
              end={tab.path === ''}
              className={({ isActive }) =>
                `pb-4 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`
              }
            >
              {tab.name}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto">
          <Routes>
            <Route
              index
              element={
                <TabResumen
                  projectId={project.id}
                  onOpenUpload={canShowDesignUpload ? () => setUploadOpen(true) : undefined}
                />
              }
            />
            <Route path="documents" element={<TabDocumentos projectId={project.id} />} />
            <Route path="compare" element={<TabComparador projectId={project.id} />} />
            <Route path="tasks" element={<TabTareas projectId={project.id} />} />
            <Route path="activity" element={<TabActividad projectId={project.id} />} />
            <Route path="metrics" element={<TabMetricas projectId={project.id} />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </div>
      </div>

      <UploadDesignModal
        open={uploadOpen}
        projectId={project.id}
        suggestedVersion={suggestedVersion}
        currentPhase={project.phase}
        existingProposalName={latestDesignProposal?.name}
        existingProposalVersion={latestDesignProposal?.version}
        onClose={() => setUploadOpen(false)}
      />

      {/* Edit project modal (Marketing / Admin) */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-primary">Editar proyecto</h2>
              <p className="text-sm text-slate-500 mt-1">
                Actualiza los datos del briefing y la asignación de equipo.
              </p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Nombre
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Descripción
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Notas de briefing
                <textarea
                  rows={3}
                  value={editForm.briefingNotes}
                  onChange={(e) => setEditForm((f) => ({ ...f, briefingNotes: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  Fecha lanzamiento
                  <DateInput
                    value={editForm.launchDate}
                    onChange={(launchDate) => setEditForm((f) => ({ ...f, launchDate }))}
                    className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Fecha límite arte
                  <DateInput
                    value={editForm.artDeadline}
                    onChange={(artDeadline) => setEditForm((f) => ({ ...f, artDeadline }))}
                    className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Responsable de diseño
                <input
                  type="text"
                  value={editForm.designLead}
                  onChange={(e) => setEditForm((f) => ({ ...f, designLead: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Contacto I+D y Calidad
                <input
                  type="text"
                  value={editForm.regulatoryContact}
                  onChange={(e) => setEditForm((f) => ({ ...f, regulatoryContact: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-primary border border-border rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!editForm.name.trim()}
                onClick={() => {
                  void updateProject(project.id, {
                    name: editForm.name.trim(),
                    description: editForm.description.trim(),
                    briefingNotes: editForm.briefingNotes,
                    launchDate: editForm.launchDate || undefined,
                    artDeadline: editForm.artDeadline || undefined,
                    designLead: editForm.designLead.trim() || undefined,
                    regulatoryContact: editForm.regulatoryContact.trim() || undefined,
                  });
                  setEditOpen(false);
                }}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAP Code Modal */}
      {sapModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setSapModalOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-primary">
                {project.sapCode ? 'Editar código SAP' : 'Asignar código SAP'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Introduce el código SAP para <span className="font-medium text-primary">{project.name}</span>.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Código SAP
              </label>
              <input
                autoFocus
                type="text"
                value={sapInput}
                onChange={(e) => setSapInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && sapInput.trim()) {
                    void updateProject(project.id, { sapCode: sapInput.trim(), lifecycleStatus: 'Vigente' });
                    setSapModalOpen(false);
                  } else if (e.key === 'Escape') {
                    setSapModalOpen(false);
                  }
                }}
                placeholder="Ej. SAP-123456"
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSapModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-primary border border-border rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!sapInput.trim()}
                onClick={() => {
                  void updateProject(project.id, { sapCode: sapInput.trim(), lifecycleStatus: 'Vigente' });
                  setSapModalOpen(false);
                }}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;

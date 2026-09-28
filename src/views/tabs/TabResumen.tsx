import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
  ThumbsUp,
  Upload,
  XCircle,
} from 'lucide-react';

import { toast } from '../../components/ui/Toast';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ImageAnnotator } from '../../components/ui/ImageAnnotator';
import { VideoAnnotator } from '../../components/ui/VideoAnnotator';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import { ZipExplorer } from '../../components/ui/ZipExplorer';
import {
  ApproveModal,
  CommentModal,
  RejectModal,
} from '../../components/modals/PhaseActionModals';
import { useAppStore } from '../../store/useAppStore';
import { availableMarkets } from '../../data/mockSeed';
import { canApprovePhase, canManageArteFinal, canManageBriefing, getDevelopmentRejectionChain, getPendingIncomingRejection, getPhaseOrder, isAudiovisualFlow, isReviewPhase, phaseDisplayName } from '../../utils/phase';
import { formatFileSize, downloadAttachment, isZipAttachment, isZipFile } from '../../utils/files';
import { renderPdfPage } from '../../utils/pdfRenderer';

/** Abre un dataUrl o URL HTTP en una nueva pestaña. */
function openDataUrlInTab(dataUrl: string, mimeType?: string) {
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    window.open(dataUrl, '_blank')?.focus();
    return;
  }
  try {
    const [header, base64] = dataUrl.split(',');
    const mime = mimeType ?? header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (win) win.focus();
    // Revoke after a delay so the browser can finish loading
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch {
    // Fallback: create a hidden anchor and click it for download
    const a = document.createElement('a');
    a.href = dataUrl;
    a.target = '_blank';
    a.click();
  }
}
import type {
  ArteFinal,
  DesignProposal,
  ImageAnnotation,
  PhaseAction,
  ProjectAttachment,
  ProjectPhase,
} from '../../types';
import { formatDate, formatDateTime } from '../../utils/dates';

const marketLabel = (code: string) =>
  availableMarkets.find((m) => m.code === code)?.label ?? code;

interface PipelineProps {
  currentPhase: ProjectPhase;
  selectedPhase: ProjectPhase;
  onSelect: (phase: ProjectPhase) => void;
  flowType?: string | null;
}

const Pipeline: React.FC<PipelineProps> = ({ currentPhase, selectedPhase, onSelect, flowType }) => {
  const order = getPhaseOrder(flowType);
  const currentIdx = Math.max(0, order.indexOf(currentPhase));
  const isProjectApproved = currentPhase === 'Aprobado';
  const denom = Math.max(1, order.length - 1);

  return (
    <div className="flex items-start justify-between relative mt-2">
      <div className="absolute left-0 top-5 w-full h-1 bg-slate-100 z-0" />
      <div
        className={`absolute left-0 top-5 h-1 z-0 transition-all duration-500 ${
          isProjectApproved ? 'bg-emerald-500' : 'bg-accent'
        }`}
        style={{ width: `${(currentIdx / denom) * 100}%` }}
      />

      {order.map((phase, index) => {
        const isCompleted = index < currentIdx;
        const isCurrent = index === currentIdx;
        const isApproved = isCurrent && phase === 'Aprobado';
        const isFuture = index > currentIdx;
        const isSelected = phase === selectedPhase;
        const clickable = !isFuture;
        const label = phaseDisplayName(phase, flowType);

        const baseCircle =
          'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all';
        let circleClass: string;
        if (isApproved) {
          circleClass = `${baseCircle} bg-emerald-500 border-emerald-500 text-white`;
        } else if (isCompleted) {
          circleClass = `${baseCircle} bg-accent border-accent text-white`;
        } else if (isCurrent) {
          circleClass = `${baseCircle} bg-white border-accent text-accent`;
        } else {
          circleClass = `${baseCircle} bg-white border-slate-200 text-slate-300`;
        }
        if (isSelected && clickable) {
          circleClass += isApproved
            ? ' ring-4 ring-emerald-500/25 shadow-sm scale-105'
            : ' ring-4 ring-accent/20 shadow-sm scale-105';
        }

        return (
          <button
            key={phase}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onSelect(phase)}
            aria-current={isCurrent ? 'step' : undefined}
            aria-pressed={isSelected}
            className={`relative z-10 flex flex-col items-center gap-2 bg-surface px-2 ${
              clickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
            }`}
          >
            <span className={circleClass}>
              {isCompleted || isApproved ? (
                <CheckCircle2 size={20} />
              ) : isCurrent ? (
                <Clock size={20} />
              ) : (
                <Circle size={20} />
              )}
            </span>
            <span
              className={`text-xs font-medium text-center max-w-[88px] ${
                isSelected
                  ? isApproved
                    ? 'text-emerald-700 font-semibold'
                    : 'text-accent font-semibold'
                  : isApproved
                    ? 'text-emerald-700 font-semibold'
                    : isCurrent
                      ? 'text-accent'
                      : isCompleted
                        ? 'text-slate-700'
                        : 'text-slate-400'
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/** Cadena de motivos de rechazo (p. ej. Validación diseño + Aprobación Legal). */
const RejectionChainCard: React.FC<{ rejections: PhaseAction[]; title: string; description?: string }> = ({
  rejections,
  title,
  description,
}) => {
  if (rejections.length === 0) return null;
  return (
    <Card className="border-red-300 bg-red-50/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-red-800 flex items-center gap-2">
          <XCircle size={18} className="text-red-600 shrink-0" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-xs text-red-700/90 mt-1">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {rejections.map((rejection, index) => (
          <div
            key={rejection.id}
            className="border border-red-200 rounded-md bg-white/70 px-3 py-2.5"
          >
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
              {index + 1}. {rejection.phase}
            </p>
            <p className="text-sm text-red-900 mt-1.5 whitespace-pre-line leading-relaxed">
              {rejection.comment}
            </p>
            <p className="text-xs text-red-600/80 mt-2">
              {rejection.actor} · {formatDateTime(rejection.createdAt)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

interface DesignPhaseProps {
  projectId: string;
  onPreviewImage: (proposal: DesignProposal, attachment: ProjectAttachment) => void;
}

const DesignPhaseView: React.FC<DesignPhaseProps> = ({ projectId, onPreviewImage }) => {
  const { projects, activeRole, uploadBriefingFiles, updateProject, designProposals, phaseActions, imageAnnotations } = useAppStore();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === projectId);
  const briefingFileInputRef = useRef<HTMLInputElement | null>(null);
  const [briefingNotes, setBriefingNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploadingBriefing, setUploadingBriefing] = useState(false);
  const [briefingPdfPreview, setBriefingPdfPreview] = useState<{
    fileName: string;
    dataUrl: string;
  } | null>(null);

  useEffect(() => {
    setBriefingNotes(project?.briefing?.notes ?? '');
  }, [project?.briefing?.notes, project?.id]);

  const designRelatedProposals = useMemo(
    () =>
      designProposals
        .filter(
          (p) =>
            p.projectId === projectId &&
            (!p.uploadedPhase ||
              p.uploadedPhase === 'Diseño' ||
              p.uploadedPhase === 'Aprobación Diseño'),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [designProposals, projectId],
  );

  const designReviewActions = useMemo(
    () =>
      phaseActions
        .filter((a) => a.projectId === projectId && a.phase === 'Aprobación Diseño')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [phaseActions, projectId],
  );

  const proposalAnnotations = useMemo(() => {
    const map = new Map<string, ImageAnnotation[]>();
    for (const proposal of designRelatedProposals) {
      const items = imageAnnotations
        .filter((a) => a.proposalId === proposal.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (items.length > 0) map.set(proposal.id, items);
    }
    return map;
  }, [designRelatedProposals, imageAnnotations]);

  if (!project) return null;

  const canEditBriefing = canManageBriefing(activeRole, project.phase);
  const hasBriefingContent =
    Boolean(project.briefing?.notes) ||
    (project.briefing?.files?.length ?? 0) > 0 ||
    Boolean(project.briefing?.fileName) ||
    (project.briefing?.refs?.length ?? 0) > 0;

  const onBriefingFilesChosen = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setUploadingBriefing(true);
    try {
      await uploadBriefingFiles(projectId, Array.from(fileList));
    } finally {
      setUploadingBriefing(false);
      if (briefingFileInputRef.current) briefingFileInputRef.current.value = '';
    }
  };

  const saveBriefingNotes = async () => {
    setSavingNotes(true);
    try {
      await updateProject(projectId, { briefingNotes });
    } finally {
      setSavingNotes(false);
    }
  };

  const markets =
    project.markets && project.markets.length > 0 ? project.markets : [project.language];
  const languages =
    project.labelLanguages && project.labelLanguages.length > 0 ? project.labelLanguages : [];

  const showReviewFeedback =
    designReviewActions.length > 0 || proposalAnnotations.size > 0;

  return (
    <>
    <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Datos del proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                Código de artículo
              </p>
              <p className="font-mono text-primary">{project.sku}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                Estado
              </p>
              <p className="font-medium text-primary">{project.status}</p>
            </div>
            {project.productLine && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                  Gama
                </p>
                <p className="font-medium text-primary">{project.productLine}</p>
              </div>
            )}
            {project.format && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                  Formato
                </p>
                <p className="font-medium text-primary">{project.format}</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                Responsable
              </p>
              {project.marketingAssigneeType === 'agent' && project.marketingAgentName ? (
                <p className="font-medium text-primary inline-flex items-center gap-1.5 flex-wrap">
                  {project.marketingAgentName}
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                    Agente IA
                  </span>
                </p>
              ) : (
                <p className="font-medium text-primary">{project.owner || '—'}</p>
              )}
            </div>
            {(project.regulatoryAssigneeType === 'agent' && project.regulatoryAgentName) ||
            project.regulatoryContact ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                  Regulatory
                </p>
                {project.regulatoryAssigneeType === 'agent' && project.regulatoryAgentName ? (
                  <p className="font-medium text-primary inline-flex items-center gap-1.5 flex-wrap">
                    {project.regulatoryAgentName}
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                      Agente IA
                    </span>
                  </p>
                ) : (
                  <p className="font-medium text-primary">{project.regulatoryContact}</p>
                )}
              </div>
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                Fecha de lanzamiento
              </p>
              <p className="font-medium text-primary">
                {formatDate(project.launchDate ?? project.targetDate)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                Fecha límite arte
              </p>
              <p className="font-medium text-primary">{formatDate(project.artDeadline)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                Mercados
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {markets.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    <span className="font-mono text-[10px] tracking-wide text-slate-500">
                      {code}
                    </span>
                    <span>{marketLabel(code)}</span>
                  </span>
                ))}
              </div>
            </div>
            {languages.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                  Idiomas etiqueta
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {languages.map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex items-center px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {project.description && (
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                  Descripción
                </p>
                <p className="text-slate-700 leading-relaxed">{project.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Briefing creativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Multi-file briefing (new format) */}
          {(project.briefing?.files?.length ?? 0) > 0 && (
            <ul className="space-y-2">
              {project.briefing!.files!.map((f, idx) => (
                <li key={idx} className="flex items-center gap-3 p-3 bg-slate-50 border border-border rounded-lg">
                  <div className="w-9 h-9 rounded-md bg-red-50 text-red-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {f.mimeType.includes('pdf') ? 'PDF' : f.name.split('.').pop()?.toUpperCase().slice(0, 3) ?? 'DOC'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{f.name}</p>
                    <p className="text-xs text-slate-500">{f.sizeKb.toLocaleString()} KB</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (f.mimeType.includes('pdf')) {
                          setBriefingPdfPreview({ fileName: f.name, dataUrl: f.dataUrl });
                        } else {
                          openDataUrlInTab(f.dataUrl, f.mimeType);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover px-2.5 py-1.5 rounded-md border border-accent/30 hover:bg-accent/5 transition-colors"
                    >
                      <ExternalLink size={12} /> Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadAttachment(f)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-primary px-2.5 py-1.5 rounded-md border border-border hover:bg-slate-100 transition-colors"
                    >
                      Descargar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {/* Legacy single-file (backward compat) */}
          {!(project.briefing?.files?.length) && project.briefing?.fileName && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-border rounded-lg">
              <div className="w-10 h-10 rounded-md bg-red-50 text-red-600 flex items-center justify-center font-semibold text-xs shrink-0">
                {project.briefing.mimeType?.includes('pdf') ? 'PDF' : <FileText size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">{project.briefing.fileName}</p>
                <p className="text-xs text-slate-500">
                  {project.briefing.fileSizeKb ? `${project.briefing.fileSizeKb.toLocaleString()} KB` : 'Subido'}
                  {project.briefing.uploadedAt && (
                    <><span className="mx-1.5">·</span>{formatDate(project.briefing.uploadedAt)}</>
                  )}
                </p>
              </div>
              {project.briefing.dataUrl && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const url = project.briefing!.dataUrl!;
                      const mime = project.briefing!.mimeType;
                      if (mime?.includes('pdf')) {
                        setBriefingPdfPreview({
                          fileName: project.briefing!.fileName!,
                          dataUrl: url,
                        });
                      } else {
                        openDataUrlInTab(url, mime);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover px-2.5 py-1.5 rounded-md border border-accent/30 hover:bg-accent/5 transition-colors"
                  >
                    <ExternalLink size={12} /> Ver
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void downloadAttachment({
                        fileName: project.briefing!.fileName!,
                        downloadUrl: project.briefing!.downloadUrl,
                        dataUrl: project.briefing!.dataUrl,
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-primary px-2.5 py-1.5 rounded-md border border-border hover:bg-slate-100 transition-colors"
                  >
                    Descargar
                  </button>
                </div>
              )}
            </div>
          )}
          {project.briefing?.notes && (
            <div className="text-sm text-slate-700 leading-relaxed bg-amber-50/60 border-l-2 border-amber-300 px-3 py-2 rounded-r-md whitespace-pre-line">
              {project.briefing.notes}
            </div>
          )}

          {/* Referenced projects */}
          {(project.briefing?.refs?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Proyectos de referencia
              </p>
              <ul className="space-y-1.5">
                {project.briefing!.refs!.map((ref) => (
                  <li key={ref.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${ref.id}`)}
                      className="group w-full flex items-center gap-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                        <FolderKanban size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-blue-800 truncate">{ref.name}</p>
                        <p className="text-xs text-blue-500 font-mono">{ref.sku}</p>
                      </div>
                      <ArrowUpRight size={14} className="text-blue-400 shrink-0 group-hover:text-blue-600 transition-colors" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasBriefingContent && !canEditBriefing && (
            <p className="text-xs text-slate-400">
              Aún no se ha registrado el briefing. Marketing puede añadirlo al editar el proyecto.
            </p>
          )}

          {canEditBriefing && (
            <div className="pt-2 border-t border-border space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {hasBriefingContent ? 'Añadir al briefing' : 'Registrar briefing'}
              </p>
              <button
                type="button"
                onClick={() => briefingFileInputRef.current?.click()}
                disabled={uploadingBriefing}
                className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-lg py-5 px-4 text-sm text-slate-500 hover:border-accent hover:bg-accent/5 transition-colors disabled:opacity-60"
              >
                {uploadingBriefing ? (
                  <Loader2 size={18} className="text-accent animate-spin" />
                ) : (
                  <Upload size={18} className="text-slate-400" />
                )}
                <span>
                  <span className="text-accent font-medium">
                    {uploadingBriefing ? 'Subiendo…' : 'Añadir archivos'}
                  </span>
                  {' '}· PDF, AI, PNG, JPG
                </span>
              </button>
              <input
                ref={briefingFileInputRef}
                type="file"
                accept=".pdf,.ai,.png,.jpg,.jpeg"
                multiple
                className="hidden"
                onChange={(e) => void onBriefingFilesChosen(e.target.files)}
              />
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">
                  Notas para el equipo
                </label>
                <textarea
                  value={briefingNotes}
                  onChange={(e) => setBriefingNotes(e.target.value)}
                  rows={3}
                  placeholder="Claims, referencias visuales, restricciones normativas, contexto del rediseño…"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveBriefingNotes()}
                    disabled={savingNotes || briefingNotes === (project.briefing?.notes ?? '')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingNotes ? (
                      <>
                        <Loader2 size={12} className="animate-spin" /> Guardando…
                      </>
                    ) : (
                      'Guardar notas'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {showReviewFeedback && (
      <div className="space-y-6">
        {designRelatedProposals.map((proposal) => {
          const annotations = proposalAnnotations.get(proposal.id) ?? [];
          return (
            <Card key={proposal.id} className="border-slate-200">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{proposal.name}</CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    {proposal.version} · Subida por {proposal.uploadedBy} el{' '}
                    {formatDateTime(proposal.createdAt)}
                    {proposal.uploadedPhase && proposal.uploadedPhase !== 'Diseño' && (
                      <> · Fase: {proposal.uploadedPhase}</>
                    )}
                  </p>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-semibold shrink-0">
                  {proposal.version}
                </span>
              </CardHeader>
              <CardContent className="space-y-5">
                {proposal.comments && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                      Notas de la propuesta
                    </p>
                    <p className="text-sm text-slate-700 bg-slate-50 border border-border rounded-md px-3 py-2">
                      {proposal.comments}
                    </p>
                  </div>
                )}

                {annotations.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">
                      Comentarios sobre el arte ({annotations.length})
                    </p>
                    <ul className="space-y-2">
                      {annotations.map((ann, i) => (
                        <li
                          key={ann.id}
                          className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-border bg-white"
                        >
                          <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center">
                            {ann.position ? i + 1 : '·'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-primary leading-snug">{ann.text}</p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              {ann.author}
                              {ann.position &&
                                ` · Pin ${Math.round(ann.position.x * 100)}%×${Math.round(ann.position.y * 100)}%`}
                              {ann.page && ann.page > 1 ? ` · Pág. ${ann.page}` : ''}
                              {' · '}
                              {formatDateTime(ann.createdAt)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {proposal.attachments.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">
                      Archivos de la propuesta
                    </p>
                    <p className="text-xs text-slate-500 mb-3">
                      Haz clic en una imagen para abrir el visor con los pins de comentarios.
                    </p>
                    <AttachmentGallery
                      attachments={proposal.attachments}
                      onPreviewImage={(att) => onPreviewImage(proposal, att)}
                    />
                  </div>
                )}

                {annotations.length === 0 &&
                  !proposal.comments &&
                  proposal.attachments.length === 0 && (
                    <p className="text-sm text-slate-400">Sin comentarios específicos sobre esta propuesta.</p>
                  )}
              </CardContent>
            </Card>
          );
        })}

        {designReviewActions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de revisión (Aprobación Diseño)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {designReviewActions.map((action) => {
                const isApprove = action.type === 'approve';
                const isReject = action.type === 'reject';
                return (
                  <div
                    key={action.id}
                    className={`flex items-start gap-3 p-3 rounded-md border ${
                      isApprove
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : isReject
                          ? 'bg-red-50/60 border-red-200'
                          : 'bg-slate-50 border-border'
                    }`}
                  >
                    <span
                      className={`mt-0.5 ${
                        isApprove
                          ? 'text-emerald-600'
                          : isReject
                            ? 'text-red-600'
                            : 'text-slate-500'
                      }`}
                    >
                      {isApprove ? (
                        <ThumbsUp size={16} />
                      ) : isReject ? (
                        <XCircle size={16} />
                      ) : (
                        <MessageCircle size={16} />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary">
                        <strong>{action.actor}</strong>{' '}
                        <span className="text-slate-500">
                          {isApprove ? 'aprobó' : isReject ? 'rechazó' : 'comentó'} la revisión
                        </span>
                      </p>
                      {action.comment && (
                        <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">{action.comment}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{formatDateTime(action.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    )}
    </div>

      <PdfViewerModal
        open={!!briefingPdfPreview}
        fileName={briefingPdfPreview?.fileName ?? ''}
        dataUrl={briefingPdfPreview?.dataUrl ?? ''}
        onClose={() => setBriefingPdfPreview(null)}
      />
    </>
  );
};

/** Miniatura asíncrona para un PDF (renderiza la página 1). */
const PdfThumbnail: React.FC<{ att: ProjectAttachment; onClick: () => void }> = ({ att, onClick }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    renderPdfPage(att.dataUrl, 1, 1)
      .then((url) => { if (!cancelled) { setThumbUrl(url); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [att.dataUrl]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-slate-50 hover:border-accent transition-colors"
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-accent rounded-full animate-spin" />
        </div>
      )}
      {thumbUrl && (
        <img
          src={thumbUrl}
          alt={att.fileName}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      )}
      {!loading && !thumbUrl && (
        <div className="absolute inset-0 flex items-center justify-center">
          <FileText size={32} className="text-slate-400" />
        </div>
      )}
      <span className="absolute top-1 right-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
        PDF
      </span>
      <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/70 to-transparent px-2 py-2 text-[11px] text-white truncate">
        {att.fileName}
      </span>
    </button>
  );
};

interface AttachmentGalleryProps {
  attachments: ProjectAttachment[];
  onPreviewImage: (att: ProjectAttachment) => void;
}

const AttachmentGallery: React.FC<AttachmentGalleryProps> = ({ attachments, onPreviewImage }) => {
  if (attachments.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Esta propuesta no tiene archivos adjuntos.
      </p>
    );
  }
  // Images, PDFs and videos are previewable / annotatable
  const previewable = attachments.filter(
    (a) => a.isImage || a.isPdf || a.isVideo || a.mimeType.startsWith('video/'),
  );
  const others = attachments.filter(
    (a) => !(a.isImage || a.isPdf || a.isVideo || a.mimeType.startsWith('video/')),
  );

  return (
    <div className="space-y-4">
      {previewable.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {previewable.map((att) =>
            att.isPdf ? (
              <PdfThumbnail key={att.id} att={att} onClick={() => onPreviewImage(att)} />
            ) : att.isVideo || att.mimeType.startsWith('video/') ? (
              <button
                key={att.id}
                type="button"
                onClick={() => onPreviewImage(att)}
                className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-slate-900 hover:border-accent transition-colors"
              >
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={att.dataUrl}
                  className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100"
                  muted
                  preload="metadata"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-10 h-10 rounded-full bg-black/55 text-white flex items-center justify-center text-xs font-semibold">
                    ▶
                  </span>
                </span>
                <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/80 to-transparent px-2 py-2 text-[11px] text-white truncate">
                  {att.fileName}
                </span>
              </button>
            ) : (
              <button
                key={att.id}
                type="button"
                onClick={() => onPreviewImage(att)}
                className="group relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-slate-50 hover:border-accent transition-colors"
              >
                <img
                  src={att.dataUrl}
                  alt={att.fileName}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/70 to-transparent px-2 py-2 text-[11px] text-white truncate">
                  {att.fileName}
                </span>
              </button>
            ),
          )}
        </div>
      )}
      {others.length > 0 && (
        <ul className="space-y-2">
          {others.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 p-2.5 bg-slate-50 border border-border rounded-md"
            >
              <div className="w-10 h-10 rounded-md bg-white border border-border flex items-center justify-center text-slate-500">
                <ImageIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">{file.fileName}</p>
                <p className="text-xs text-slate-500">
                  {formatFileSize(file.fileSizeKb)}
                  <span className="mx-1.5">·</span>
                  {file.mimeType || 'Archivo'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void downloadAttachment(file)}
                className="text-xs font-medium text-accent hover:text-accent-hover"
              >
                Descargar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface ReviewPhaseViewProps {
  projectId: string;
  selectedPhase: ProjectPhase;
  isCurrent: boolean;
  proposal?: DesignProposal;
  phaseActions: PhaseAction[];
  onComment: () => void;
  onReject: () => void;
  onApprove: () => void;
  onPreviewImage: (att: ProjectAttachment) => void;
  /** Arte final object (sólo relevante cuando selectedPhase === 'Aprobación final'). */
  arteFinal?: ArteFinal;
  activeRole: string;
  canAddDesignFiles?: boolean;
  /** Rechazo de la fase siguiente que devolvió el proyecto aquí (p. ej. Legal → Validación diseño). */
  pendingIncomingRejection?: PhaseAction;
  flowType?: string | null;
}

const ReviewPhaseView: React.FC<ReviewPhaseViewProps> = ({
  selectedPhase,
  isCurrent,
  proposal,
  phaseActions,
  onComment,
  onReject,
  onApprove,
  onPreviewImage,
  arteFinal,
  activeRole,
  canAddDesignFiles,
  pendingIncomingRejection,
  flowType,
}) => {
  const isFinalPhase = selectedPhase === 'Aprobación final';
  const isAprobado = selectedPhase === 'Aprobado';
  const phaseLabel = phaseDisplayName(selectedPhase, flowType);
  const isAv = isAudiovisualFlow(flowType);

  return (
    <div className="space-y-6">
      {pendingIncomingRejection && (
        <Card className="border-red-300 bg-red-50/80">
          <CardContent className="flex items-start gap-3 py-4">
            <XCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-800">
                Rechazado en {pendingIncomingRejection.phase}
              </p>
              <p className="text-sm text-red-700 mt-1.5 whitespace-pre-line leading-relaxed">
                {pendingIncomingRejection.comment}
              </p>
              <p className="text-xs text-red-600/80 mt-2">
                {pendingIncomingRejection.actor} ·{' '}
                {formatDateTime(pendingIncomingRejection.createdAt)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Aprobación final: arte final download + ZIP explorer ── */}
      {(isFinalPhase || isAprobado) ? (
        <>
          {/* "Aprobado" locked banner (only when fully closed) */}
          {isAprobado && (
            <Card className="bg-emerald-50/40 border-emerald-200">
              <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-5">
                <div className="flex items-center gap-3">
                  <Lock className="text-emerald-600 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Proyecto aprobado y cerrado</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      El arte master ha sido aprobado definitivamente. Proyecto en sólo lectura.
                    </p>
                  </div>
                </div>
                {arteFinal && (
                  <button
                    type="button"
                    onClick={() => void downloadAttachment(arteFinal.attachment)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors shrink-0"
                  >
                    <ExternalLink size={14} />
                    Descargar arte final
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Arte final file + explorer */}
          {arteFinal ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>Arte Final</CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    Subido por {arteFinal.uploadedBy} · {arteFinal.attachment.fileName}
                    {arteFinal.attachment.fileSizeKb > 0 && (
                      <> · {(arteFinal.attachment.fileSizeKb / 1024).toFixed(1)} MB</>
                    )}
                  </p>
                </div>
                {/* En Aprobado basta el botón grande «Descargar arte final» del banner */}
                {!isAprobado && (
                  <button
                    type="button"
                    onClick={() => void downloadAttachment(arteFinal.attachment)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-accent px-3 py-1.5 rounded-md border border-border hover:border-accent/40 hover:bg-accent/5 transition-colors shrink-0"
                  >
                    <ExternalLink size={13} /> Descargar
                  </button>
                )}
              </CardHeader>
              <CardContent>
                {isZipAttachment(arteFinal.attachment) ? (
                  <ZipExplorer
                    dataUrl={arteFinal.attachment.dataUrl || arteFinal.attachment.downloadUrl || ''}
                    fileName={arteFinal.attachment.fileName}
                  />
                ) : arteFinal.attachment.isVideo ||
                  arteFinal.attachment.mimeType.startsWith('video/') ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={arteFinal.attachment.dataUrl || arteFinal.attachment.downloadUrl || ''}
                    controls
                    className="w-full max-h-80 rounded-lg border border-border bg-black"
                  />
                ) : arteFinal.attachment.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={arteFinal.attachment.dataUrl || arteFinal.attachment.downloadUrl || ''}
                    alt={arteFinal.attachment.fileName}
                    className="w-full max-h-80 object-contain rounded-lg border border-border bg-slate-50"
                  />
                ) : (
                  <div className="rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Archivo:{' '}
                    <span className="font-medium text-primary">{arteFinal.attachment.fileName}</span>
                    . Usa «Descargar» para obtenerlo.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-slate-400 text-sm">
                No se subió ningún arte final en la fase anterior.
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* ── Normal review phase: show proposal ── */
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>{`Propuesta en revisión · ${phaseLabel}`}</CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                {proposal
                  ? `Subida por ${proposal.uploadedBy} el ${formatDateTime(proposal.createdAt)}`
                  : isAv
                    ? 'Aún no hay audiovisual asociado.'
                    : 'Aún no hay propuesta de diseño asociada.'}
              </p>
            </div>
            {proposal && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-semibold">
                {proposal.version}
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {!proposal && (
              <p className="text-sm text-slate-500">
                {isAv
                  ? 'No se ha subido aún material audiovisual. Vuelve a la fase «Desarrollo» y usa el botón «Subir audiovisual» en la cabecera.'
                  : 'No se ha subido aún una propuesta de diseño para este proyecto. Vuelve a la fase «Diseño» y usa el botón «Subir propuesta de diseño» en la cabecera.'}
              </p>
            )}
            {proposal && (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                    Nombre de la propuesta
                  </p>
                  <p className="text-base font-medium text-primary">{proposal.name}</p>
                </div>
                {canAddDesignFiles && (
                  <p className="text-xs text-slate-500 bg-slate-50 border border-border rounded-lg px-3 py-2">
                    Puedes añadir más archivos con el botón «Añadir archivos» en la cabecera mientras
                    Marketing revisa. La fase no cambiará.
                  </p>
                )}
                {proposal.comments && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                      Comentarios del equipo de Diseño
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-border rounded-md px-3 py-2">
                      {proposal.comments}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">
                    Adjuntos
                  </p>
                  <AttachmentGallery
                    attachments={proposal.attachments}
                    onPreviewImage={onPreviewImage}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico de la fase */}
      {phaseActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico en {selectedPhase}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {phaseActions.map((action) => {
              const isApprove = action.type === 'approve';
              const isReject = action.type === 'reject';
              return (
                <div
                  key={action.id}
                  className={`flex items-start gap-3 p-3 rounded-md border ${
                    isApprove
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : isReject
                        ? 'bg-red-50/60 border-red-200'
                        : 'bg-slate-50 border-border'
                  }`}
                >
                  <span
                    className={`mt-0.5 ${
                      isApprove
                        ? 'text-emerald-600'
                        : isReject
                          ? 'text-red-600'
                          : 'text-slate-500'
                    }`}
                  >
                    {isApprove ? (
                      <ThumbsUp size={16} />
                    ) : isReject ? (
                      <XCircle size={16} />
                    ) : (
                      <MessageCircle size={16} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary">
                      <strong>{action.actor}</strong>{' '}
                      <span className="text-slate-500">
                        {isApprove ? 'aprobó' : isReject ? 'rechazó' : 'comentó'} esta fase
                      </span>
                    </p>
                    {action.comment && (
                      <p className="text-sm text-slate-700 mt-1">"{action.comment}"</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDateTime(action.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Acciones — solo roles autorizados para esta fase */}
      {isCurrent && !isAprobado && canApprovePhase(activeRole, selectedPhase) && (
        <Card>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-primary">Acciones disponibles</p>
              <p className="text-xs text-slate-500">
                Puedes comentar sin cambiar de fase, o rechazar / aprobar en {selectedPhase}.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onComment}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-border bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors"
              >
                <MessageCircle size={16} /> Comentar
              </button>
              <button
                type="button"
                onClick={onReject}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-semibold transition-colors"
              >
                <XCircle size={16} /> Rechazar
              </button>
              <button
                type="button"
                onClick={onApprove}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-semibold transition-colors"
              >
                <ThumbsUp size={16} /> Aprobar
              </button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

// ─── Arte final view ─────────────────────────────────────────────────────────

interface FinalPrepViewProps {
  projectId: string;
  isCurrent: boolean;
  arteFinal?: ArteFinal;
  phaseActions: PhaseAction[];
  activeRole: string;
}

const FinalPrepView: React.FC<FinalPrepViewProps> = ({
  projectId,
  isCurrent,
  arteFinal,
  phaseActions,
  activeRole,
}) => {
  const { addArteFinal, approveCurrentPhase } = useAppStore();
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingBlobUrl, setPendingBlobUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!pendingFile) {
      setPendingBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const selectFile = (file?: File) => {
    if (!file) return;
    setPendingFile(file);
  };

  const clearPending = () => {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendToFinalApproval = async () => {
    if (submitting || (!pendingFile && !arteFinal)) return;
    setSubmitting(true);
    try {
      if (pendingFile) {
        setSubmitProgress('Subiendo arte final…');
        await addArteFinal(projectId, pendingFile);
        clearPending();
      }
      setSubmitProgress('Enviando a aprobación final…');
      await approveCurrentPhase(projectId);
    } catch {
      /* toast ya lo muestra el store */
    } finally {
      setSubmitting(false);
      setSubmitProgress(null);
    }
  };

  const isZip = arteFinal ? isZipAttachment(arteFinal.attachment) : false;
  const pendingIsZip = pendingFile ? isZipFile(pendingFile) : false;
  const pendingIsVideo = pendingFile?.type.startsWith('video/') ?? false;
  const pendingIsImage = pendingFile?.type.startsWith('image/') ?? false;
  const canEdit = isCurrent && canManageArteFinal(activeRole, 'Arte final');
  const pendingSizeLabel = pendingFile
    ? formatFileSize(Math.max(1, Math.round(pendingFile.size / 1024)))
    : '';
  const canSend = Boolean(pendingFile || arteFinal);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Arte final</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              {pendingFile
                ? 'Revisa el archivo antes de enviarlo a aprobación final.'
                : arteFinal
                  ? `Subido por ${arteFinal.uploadedBy} el ${formatDateTime(arteFinal.createdAt)}`
                  : 'Selecciona el archivo de arte final / master para enviarlo a aprobación.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {arteFinal && (
              <button
                type="button"
                onClick={() =>
                  void downloadAttachment(arteFinal.attachment)
                }
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-accent px-2.5 py-1.5 rounded-md border border-border hover:border-accent/40 hover:bg-accent/5 transition-colors"
              >
                <ExternalLink size={13} /> Descargar
              </button>
            )}
            {arteFinal && canEdit && !pendingFile && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-accent border border-border rounded-md px-2.5 py-1.5 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} /> Reemplazar
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            className="hidden"
            onChange={(e) => {
              selectFile(e.target.files?.[0]);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />

          {pendingFile && pendingBlobUrl ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary truncate">{pendingFile.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {pendingSizeLabel} · previsualización local (aún no guardado)
                  </p>
                </div>
                {!submitting && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-slate-500 hover:text-primary transition-colors"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={clearPending}
                      className="text-xs text-slate-400 hover:text-red-600 transition-colors"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>
              {pendingIsZip ? (
                <ZipExplorer dataUrl={pendingBlobUrl} fileName={pendingFile.name} />
              ) : pendingIsVideo ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={pendingBlobUrl}
                  controls
                  className="w-full max-h-80 rounded-lg border border-border bg-black"
                />
              ) : pendingIsImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pendingBlobUrl}
                  alt={pendingFile.name}
                  className="w-full max-h-80 object-contain rounded-lg border border-border bg-slate-50"
                />
              ) : null}
            </div>
          ) : arteFinal && !pendingFile ? (
            isZip ? (
              <ZipExplorer
                dataUrl={arteFinal.attachment.dataUrl || arteFinal.attachment.downloadUrl || ''}
                fileName={arteFinal.attachment.fileName}
              />
            ) : arteFinal.attachment.isVideo ||
              arteFinal.attachment.mimeType.startsWith('video/') ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={arteFinal.attachment.dataUrl || arteFinal.attachment.downloadUrl || ''}
                controls
                className="w-full max-h-80 rounded-lg border border-border bg-black"
              />
            ) : arteFinal.attachment.isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={arteFinal.attachment.dataUrl || arteFinal.attachment.downloadUrl || ''}
                alt={arteFinal.attachment.fileName}
                className="w-full max-h-80 object-contain rounded-lg border border-border bg-slate-50"
              />
            ) : (
              <div className="rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Archivo listo para descargar:{' '}
                <span className="font-medium text-primary">{arteFinal.attachment.fileName}</span>
              </div>
            )
          ) : canEdit ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                selectFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-16 px-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-accent bg-accent/5'
                  : 'border-slate-200 bg-slate-50 hover:border-accent hover:bg-accent/5'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <Upload size={22} />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">
                  <span className="text-accent">Haz clic para elegir</span> o arrastra el archivo
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  ZIP, vídeo, imagen, PDF u otros formatos
                </p>
              </div>
              <p className="text-xs text-slate-400 max-w-sm">
                Podrás revisarlo antes de enviarlo a aprobación final.
              </p>
            </div>
          ) : isCurrent ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <Clock size={18} />
              Pendiente de que Diseño suba el arte final.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
              <FileText size={18} />
              No se subió arte final en esta fase.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      {phaseActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico en Arte final</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {phaseActions.map((action) => {
              const isApprove = action.type === 'approve';
              const isReject = action.type === 'reject';
              return (
                <div
                  key={action.id}
                  className={`flex items-start gap-3 p-3 rounded-md border ${
                    isApprove
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : isReject
                        ? 'bg-red-50/60 border-red-200'
                        : 'bg-slate-50 border-border'
                  }`}
                >
                  <span className={`mt-0.5 ${isApprove ? 'text-emerald-600' : isReject ? 'text-red-600' : 'text-slate-500'}`}>
                    {isApprove ? <ThumbsUp size={16} /> : isReject ? <XCircle size={16} /> : <MessageCircle size={16} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary">
                      <strong>{action.actor}</strong>{' '}
                      <span className="text-slate-500">
                        {isApprove ? 'aprobó' : isReject ? 'rechazó' : 'comentó'} esta fase
                      </span>
                    </p>
                    {action.comment && (
                      <p className="text-sm text-slate-700 mt-1">"{action.comment}"</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{formatDateTime(action.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Acciones — solo Diseño */}
      {canEdit && (
        <Card>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-primary">Enviar a aprobación final</p>
              <p className="text-xs text-slate-500">
                {pendingFile
                  ? 'Al confirmar, el archivo se guardará y el proyecto pasará a Aprobación Final.'
                  : 'Confirma el envío del arte final ya subido a la siguiente fase.'}
              </p>
              {submitProgress && (
                <p className="text-xs text-accent mt-1.5 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  {submitProgress}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleSendToFinalApproval()}
              disabled={!canSend || submitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <Upload size={16} /> Enviar a Aprobación Final
                </>
              )}
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── Creación Desarrollo view ────────────────────────────────────────────────

interface DesarrolloPhaseViewProps {
  isCurrent: boolean;
  designProposal?: DesignProposal;
  desarrolloProposal?: DesignProposal;
  rejectionChain?: PhaseAction[];
  showRejectionChain?: boolean;
}

const DesarrolloPhaseView: React.FC<DesarrolloPhaseViewProps> = ({
  isCurrent,
  designProposal,
  desarrolloProposal,
  rejectionChain = [],
  showRejectionChain = false,
}) => {
  return (
    <div className="space-y-6">
      {showRejectionChain && rejectionChain.length > 0 && (
        <RejectionChainCard
          rejections={rejectionChain}
          title="Cambios solicitados en el desarrollo"
          description="Motivos del rechazo en las fases de revisión. Aplica las correcciones y vuelve a subir el archivo de desarrollo."
        />
      )}

      {/* Design context */}
      {designProposal && (
        <Card>
          <CardHeader>
            <CardTitle>Diseño aprobado (referencia)</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              Propuesta de diseño que fue aprobada y sobre la que se debe crear el desarrollo.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-border rounded-lg">
              <div className="w-9 h-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">{designProposal.name}</p>
                <p className="text-xs text-slate-500">{designProposal.version} · {designProposal.attachments.length} adjunto(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status card */}
      <Card className={isCurrent ? 'border-accent/30 bg-accent/5' : ''}>
        <CardContent className="flex items-start gap-4 py-5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            desarrolloProposal ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
          }`}>
            {desarrolloProposal ? <CheckCircle2 size={20} /> : <Clock size={20} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">
              {desarrolloProposal
                ? 'Archivo de desarrollo subido'
                : isCurrent
                  ? 'Pendiente de subir el archivo de desarrollo'
                  : 'No se subió archivo de desarrollo'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {desarrolloProposal
                ? `"${desarrolloProposal.name}" (${desarrolloProposal.version}) — el proyecto avanzó a Validación diseño`
                : isCurrent
                  ? 'Usa el botón «Subir archivo de desarrollo» en la cabecera para adjuntar el archivo técnico.'
                  : ''}
            </p>
            {desarrolloProposal && (
              <div className="mt-3 space-y-2">
                {desarrolloProposal.attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 text-xs text-slate-700 bg-white border border-border rounded-md px-3 py-1.5">
                    <FileText size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{att.fileName}</span>
                    <span className="text-slate-400 ml-auto shrink-0">{formatFileSize(att.fileSizeKb)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export const TabResumen = ({
  projectId,
  onOpenUpload,
}: {
  projectId: string;
  onOpenUpload?: () => void;
}) => {
  const {
    projects,
    designProposals,
    phaseActions,
    arteFinals,
    approveCurrentPhase,
    rejectCurrentPhase,
    commentOnPhase,
    activeRole,
  } = useAppStore();

  const project = projects.find((p) => p.id === projectId);
  const [selectedPhase, setSelectedPhase] = useState<ProjectPhase | null>(
    project?.phase ?? null,
  );

  useEffect(() => {
    if (project) setSelectedPhase(project.phase);
  }, [project?.phase, project?.id]);

  const projectProposals = useMemo(
    () =>
      designProposals
        .filter((d) => d.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [designProposals, projectId],
  );

  // Latest design proposal (from Diseño phase)
  const latestDesignProposal = useMemo(
    () =>
      projectProposals.find(
        (p) =>
          !p.uploadedPhase ||
          p.uploadedPhase === 'Diseño' ||
          p.uploadedPhase === 'Aprobación Diseño',
      ),
    [projectProposals],
  );

  // Latest desarrollo proposal (from Creación Desarrollo phase)
  const latestDesarrolloProposal = useMemo(
    () => projectProposals.find((p) => p.uploadedPhase === 'Creación Desarrollo'),
    [projectProposals],
  );

  /** Proposal relevant to the currently selected review phase. */
  const proposalForSelectedPhase = useMemo(() => {
    const isAv = isAudiovisualFlow(project?.flowType);
    if (selectedPhase === 'Aprobación Diseño') {
      // Campaña AV: el material a revisar es el subido en Desarrollo.
      return isAv
        ? (latestDesarrolloProposal ?? latestDesignProposal)
        : latestDesignProposal;
    }
    if (selectedPhase === 'Validación diseño' || selectedPhase === 'Aprobación Legal') {
      return latestDesarrolloProposal;
    }
    if (selectedPhase === 'Aprobación final' && isAv) {
      return latestDesarrolloProposal ?? latestDesignProposal;
    }
    return latestDesignProposal;
  }, [
    selectedPhase,
    latestDesignProposal,
    latestDesarrolloProposal,
    project?.flowType,
  ]);

  const projectActions = useMemo(
    () => phaseActions.filter((a) => a.projectId === projectId),
    [phaseActions, projectId],
  );

  const latestArteFinal = useMemo(
    () =>
      arteFinals
        .filter((a) => a.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [arteFinals, projectId],
  );

  const pendingIncomingRejection = useMemo(() => {
    if (!project || !selectedPhase) return undefined;
    return getPendingIncomingRejection(
      projectActions,
      selectedPhase,
      projectId,
      project.phase,
      project.status,
      project.flowType,
    );
  }, [projectActions, selectedPhase, projectId, project?.phase, project?.status, project?.flowType, project]);

  const developmentRejectionChain = useMemo(
    () =>
      getDevelopmentRejectionChain(
        projectActions,
        projectId,
        latestDesarrolloProposal?.createdAt,
      ),
    [projectActions, projectId, latestDesarrolloProposal?.createdAt],
  );

  const showDevelopmentRejectionChain = useMemo(() => {
    if (!project || developmentRejectionChain.length === 0) return false;
    return (
      project.phase === 'Creación Desarrollo' ||
      (project.phase === 'Validación diseño' && project.status === 'Cambios solicitados')
    );
  }, [project, developmentRejectionChain.length]);

  const [commentOpen, setCommentOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [activeAttachment, setActiveAttachment] = useState<ProjectAttachment | null>(null);
  const [annotatorProposal, setAnnotatorProposal] = useState<DesignProposal | null>(null);
  const [annotatorReadOnly, setAnnotatorReadOnly] = useState(false);

  const openProposalImage = (
    proposal: DesignProposal,
    attachment: ProjectAttachment,
    readOnly = false,
  ) => {
    setAnnotatorProposal(proposal);
    setActiveAttachment(attachment);
    setAnnotatorReadOnly(readOnly);
  };

  const annotatorProposalResolved = annotatorProposal ?? proposalForSelectedPhase;

  if (!project || !selectedPhase) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isCurrent = selectedPhase === project.phase;
  const canDesignRole = activeRole === 'Diseño' || activeRole === 'Admin';
  const canAddFilesOnDesignReview =
    Boolean(onOpenUpload) &&
    canDesignRole &&
    isCurrent &&
    project.phase === 'Aprobación Diseño';
  const phaseSpecificActions = projectActions.filter((a) => a.phase === selectedPhase);

  return (
    <div className="space-y-8">
      {/* Pipeline */}
      <Card>
        <CardHeader>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <CardTitle>Flujo de aprobación</CardTitle>
            <p className="text-xs text-slate-500">
              Pulsa cualquier fase completada o actual para ver su detalle.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <Pipeline
            currentPhase={project.phase}
            selectedPhase={selectedPhase}
            onSelect={setSelectedPhase}
            flowType={project.flowType}
          />
        </CardContent>
      </Card>

      {/* Phase content */}
      {selectedPhase === 'Diseño' ? (
        <DesignPhaseView
          projectId={projectId}
          onPreviewImage={(proposal, att) => openProposalImage(proposal, att, true)}
        />
      ) : selectedPhase === 'Creación Desarrollo' ? (
        <DesarrolloPhaseView
          isCurrent={isCurrent}
          designProposal={latestDesignProposal}
          desarrolloProposal={latestDesarrolloProposal}
          rejectionChain={developmentRejectionChain}
          showRejectionChain={showDevelopmentRejectionChain}
        />
      ) : selectedPhase === 'Arte final' ? (
        <FinalPrepView
          projectId={projectId}
          isCurrent={isCurrent}
          arteFinal={latestArteFinal}
          phaseActions={phaseSpecificActions}
          activeRole={activeRole}
        />
      ) : isReviewPhase(selectedPhase) || selectedPhase === 'Aprobado' ? (
        <ReviewPhaseView
          projectId={projectId}
          selectedPhase={selectedPhase}
          isCurrent={isCurrent}
          proposal={proposalForSelectedPhase}
          phaseActions={phaseSpecificActions}
          onComment={() => setCommentOpen(true)}
          onReject={() => setRejectOpen(true)}
          onApprove={() => setApproveOpen(true)}
          onPreviewImage={(att) => {
            if (proposalForSelectedPhase) {
              openProposalImage(proposalForSelectedPhase, att, !isCurrent);
            }
          }}
          arteFinal={latestArteFinal}
          activeRole={activeRole}
          canAddDesignFiles={
            selectedPhase === 'Aprobación Diseño' ? canAddFilesOnDesignReview : false
          }
          pendingIncomingRejection={pendingIncomingRejection}
          flowType={project.flowType}
        />
      ) : null}

      <CommentModal
        open={commentOpen}
        onClose={() => setCommentOpen(false)}
        currentPhase={project.phase}
        onSubmit={(text) => commentOnPhase(projectId, text)}
      />
      <RejectModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        currentPhase={project.phase}
        onSubmit={(text) => rejectCurrentPhase(projectId, text)}
      />
      <ApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        currentPhase={project.phase}
        onSubmit={(text) => approveCurrentPhase(projectId, text)}
      />

      {activeAttachment && annotatorProposalResolved && (
        (activeAttachment.isVideo || activeAttachment.mimeType.startsWith('video/')) ? (
          <VideoAnnotator
            open={!!activeAttachment}
            attachment={activeAttachment}
            proposal={annotatorProposalResolved}
            projectId={projectId}
            readOnly={annotatorReadOnly}
            onClose={() => {
              setActiveAttachment(null);
              setAnnotatorProposal(null);
              setAnnotatorReadOnly(false);
            }}
          />
        ) : (
          <ImageAnnotator
            open={!!activeAttachment}
            attachment={activeAttachment}
            proposal={annotatorProposalResolved}
            projectId={projectId}
            readOnly={annotatorReadOnly}
            onClose={() => {
              setActiveAttachment(null);
              setAnnotatorProposal(null);
              setAnnotatorReadOnly(false);
            }}
          />
        )
      )}
    </div>
  );
};

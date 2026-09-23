import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CalendarClock,
  ExternalLink,
  Megaphone,
  Package,
  Pencil,
  User,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../utils/dates';
import type { CampaignStatus } from '../types';

const STATUS_COLORS: Record<CampaignStatus, string> = {
  Borrador: 'bg-slate-100 text-slate-600 border-slate-200',
  'En producción': 'bg-blue-100 text-blue-700 border-blue-200',
  'En revisión': 'bg-amber-100 text-amber-700 border-amber-200',
  Aprobada: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Archivada: 'bg-slate-100 text-slate-400 border-slate-200',
};

const FormatBadge = ({ label }: { label: string }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium border border-purple-200">
    {label}
  </span>
);

const CampaignDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campaigns, projects } = useAppStore();

  const campaign = campaigns.find((c) => c.id === id);

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
        <Megaphone size={48} className="opacity-20" />
        <p className="text-lg font-medium">Campaña no encontrada</p>
        <button
          onClick={() => navigate('/campaigns')}
          className="text-sm text-accent hover:underline"
        >
          Volver al listado
        </button>
      </div>
    );
  }

  const linkedProject = projects.find((p) => p.id === campaign.projectId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-surface border-b border-border px-8 pt-6 pb-6 shrink-0">
        <button
          onClick={() => navigate('/campaigns')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Volver a campañas
        </button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Megaphone size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">{campaign.name}</h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    STATUS_COLORS[campaign.status]
                  }`}
                >
                  {campaign.status}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Package size={14} />
                  {campaign.productName}
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-xs">{campaign.productSku}</span>
                </span>
              </div>
            </div>
          </div>

          {linkedProject && (
            <button
              onClick={() => navigate(`/projects/${linkedProject.id}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-white hover:bg-slate-50 text-sm text-slate-700 font-medium transition-colors"
            >
              <ExternalLink size={15} />
              Ver proyecto de packaging
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Formatos */}
            <Card>
              <CardHeader>
                <CardTitle>Formatos de campaña</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {campaign.formats.map((f) => (
                    <FormatBadge key={f} label={f} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Briefing */}
            {(campaign.description || campaign.briefingNotes || campaign.briefingFileName) && (
              <Card>
                <CardHeader>
                  <CardTitle>Briefing creativo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {campaign.description && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                        Descripción
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {campaign.description}
                      </p>
                    </div>
                  )}
                  {campaign.briefingNotes && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                        Notas del briefing
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {campaign.briefingNotes}
                      </p>
                    </div>
                  )}
                  {campaign.briefingFileName && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-border rounded-lg">
                      <div className="w-10 h-10 rounded-md bg-red-50 text-red-600 flex items-center justify-center font-semibold text-xs shrink-0">
                        PDF
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">
                          {campaign.briefingFileName}
                        </p>
                        {campaign.briefingFileSizeKb && (
                          <p className="text-xs text-slate-500">
                            {campaign.briefingFileSizeKb.toLocaleString()} KB
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Producto vinculado */}
            {linkedProject && (
              <Card>
                <CardHeader>
                  <CardTitle>Producto vinculado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="flex items-center gap-4 p-4 bg-slate-50 border border-border rounded-xl cursor-pointer hover:bg-accent/5 transition-colors"
                    onClick={() => navigate(`/projects/${linkedProject.id}`)}
                  >
                    <div className="w-12 h-12 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-sm shrink-0">
                      {linkedProject.sku.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary">{linkedProject.name}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {linkedProject.productLine ?? ''}
                        {linkedProject.productLine && linkedProject.format ? ' · ' : ''}
                        {linkedProject.format ?? ''}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          linkedProject.phase === 'Aprobación final' || linkedProject.phase === 'Aprobado'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {linkedProject.phase}
                      </span>
                    </div>
                    <ExternalLink size={15} className="text-slate-400 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Detalles</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3 text-sm">
                <div className="flex items-start gap-2.5 text-slate-600">
                  <User size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">
                      Responsable
                    </p>
                    {campaign.owner}
                  </div>
                </div>
                {campaign.designLead && (
                  <div className="flex items-start gap-2.5 text-slate-600">
                    <Pencil size={15} className="text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">
                        Resp. diseño
                      </p>
                      {campaign.designLead}
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5 text-slate-600">
                  <Calendar size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">
                      Lanzamiento
                    </p>
                    {formatDate(campaign.launchDate)}
                  </div>
                </div>
                {campaign.artDeadline && (
                  <div className="flex items-start gap-2.5 text-slate-600">
                    <CalendarClock size={15} className="text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">
                        Límite arte
                      </p>
                      {formatDate(campaign.artDeadline)}
                    </div>
                  </div>
                )}
                <div className="border-t border-border pt-3 text-xs text-slate-400">
                  Creada el {formatDate(campaign.createdAt)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {campaign.formats.length} formato
                  {campaign.formats.length !== 1 ? 's' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 flex flex-wrap gap-1.5">
                {campaign.formats.map((f) => (
                  <FormatBadge key={f} label={f} />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetail;

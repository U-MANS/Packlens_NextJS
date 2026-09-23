import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Megaphone, Plus, Search } from 'lucide-react';

import { Card, CardHeader } from '../components/ui/Card';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../utils/dates';
import type { CampaignFormat, CampaignStatus } from '../types';

const FORMAT_GROUPS: { label: string; formats: CampaignFormat[] }[] = [
  {
    label: 'Display',
    formats: [
      'Banner estático/animado',
      'Banner expandible/interactivo',
      'Rich Media/Video Banners',
      'Formatos flotantes/Interstitials',
    ],
  },
  {
    label: 'Audiovisual',
    formats: ['Spot Publicitario', 'Motion Graphics', 'Videos Corporativos'],
  },
  {
    label: 'Contenido',
    formats: [
      'Branded Content',
      'Contenido para Redes Sociales',
      'Creatividad',
      'Lineal',
    ],
  },
];

const ALL_FORMATS: CampaignFormat[] = FORMAT_GROUPS.flatMap((g) => g.formats);

const STATUS_COLORS: Record<CampaignStatus, string> = {
  Borrador: 'bg-slate-100 text-slate-600',
  'En producción': 'bg-blue-100 text-blue-700',
  'En revisión': 'bg-amber-100 text-amber-700',
  Aprobada: 'bg-emerald-100 text-emerald-700',
  Archivada: 'bg-slate-100 text-slate-400',
};

const StatusBadge = ({ status }: { status: CampaignStatus }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status]}`}
  >
    {status}
  </span>
);

const FormatBadge = ({ format }: { format: CampaignFormat }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[11px] font-medium border border-purple-100">
    {format}
  </span>
);

const CampaignList = () => {
  const navigate = useNavigate();
  const { campaigns } = useAppStore();

  const [search, setSearch] = useState('');
  const [filterFormat, setFilterFormat] = useState<string>('Todos');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');

  const statuses: string[] = ['Todos', 'Borrador', 'En producción', 'En revisión', 'Aprobada'];

  const filtered = campaigns.filter((c) => {
    if (c.archived) return false;
    const q = search.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) || c.productName.toLowerCase().includes(q);
    const matchesFormat =
      filterFormat === 'Todos' || c.formats.includes(filterFormat as CampaignFormat);
    const matchesStatus = filterStatus === 'Todos' || c.status === filterStatus;
    return matchesSearch && matchesFormat && matchesStatus;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Campañas</h1>
          <p className="text-slate-500 mt-1">
            Gestiona las campañas creativas asociadas a productos.
          </p>
        </div>
        <button
          onClick={() => navigate('/campaigns/new')}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          <Plus size={18} />
          Nueva campaña
        </button>
      </div>

      <Card>
        {/* Filters */}
        <CardHeader className="flex flex-col sm:flex-row gap-4 border-b border-border bg-slate-50/50">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar por nombre o producto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={18} className="text-slate-400 shrink-0" />
            <select
              value={filterFormat}
              onChange={(e) => setFilterFormat(e.target.value)}
              className="border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent"
            >
              <option value="Todos">Todos los formatos</option>
              {ALL_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium">Campaña</th>
                <th className="px-6 py-4 font-medium">Producto vinculado</th>
                <th className="px-6 py-4 font-medium">Formatos</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium">Responsable</th>
                <th className="px-6 py-4 font-medium">Lanzamiento</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className="border-b border-border hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                          <Megaphone size={14} />
                        </div>
                        <span className="font-medium text-primary">{campaign.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="text-slate-700">{campaign.productName}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {campaign.productSku}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {campaign.formats.slice(0, 3).map((f) => (
                          <FormatBadge key={f} format={f} />
                        ))}
                        {campaign.formats.length > 3 && (
                          <span className="text-[11px] text-slate-400 self-center">
                            +{campaign.formats.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-600">{campaign.owner}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatDate(campaign.launchDate)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <Megaphone size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No hay campañas que coincidan</p>
                    <p className="text-sm mt-1">Crea la primera campaña con el botón superior.</p>
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

export default CampaignList;

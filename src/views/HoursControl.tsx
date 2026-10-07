'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock, Pencil, Plus, Trash2 } from 'lucide-react';

import * as api from '../api';
import type { ApiTimeEntry } from '../api';
import { TimeEntryModal } from '../components/modals/TimeEntryModal';
import { DateInput } from '../components/ui/DateInput';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../utils/dates';
import { getErrorMessage } from '../utils/errors';
import { toast } from '../components/ui/Toast';

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatHours(n: number) {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

function formatLabel(value: string, max = 18) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function groupHours(entries: ApiTimeEntry[], key: (e: ApiTimeEntry) => string) {
  const map = new Map<string, { name: string; hours: number; entries: number }>();
  for (const e of entries) {
    const name = key(e) || 'Sin asignar';
    const prev = map.get(name) ?? { name, hours: 0, entries: 0 };
    prev.hours += e.hours;
    prev.entries += 1;
    map.set(name, prev);
  }
  return [...map.values()].sort((a, b) => b.hours - a.hours);
}

const chartTooltip = {
  contentStyle: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    color: '#0f172a',
    boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
  },
};

export default function HoursControl() {
  const navigate = useNavigate();
  const projects = useAppStore((s) => s.projects);
  const [from, setFrom] = useState(monthStartIso);
  const [to, setTo] = useState(todayIso);
  const [entries, setEntries] = useState<ApiTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiTimeEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await api.listTimeEntries({ from, to }));
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error cargando horas'));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const byEmployee = useMemo(() => groupHours(entries, (e) => e.employee_name), [entries]);
  const byProject = useMemo(
    () => groupHours(entries, (e) => e.project_name || e.project_sku || 'Proyecto'),
    [entries],
  );

  const totalHours = useMemo(() => entries.reduce((acc, e) => acc + e.hours, 0), [entries]);
  const employeeCount = byEmployee.length;
  const avgHours = employeeCount ? totalHours / employeeCount : 0;
  const topProject = byProject[0]?.name ?? '—';
  const employeeNames = useMemo(() => byEmployee.map((e) => e.name), [byEmployee]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (entry: ApiTimeEntry) => {
    setEditing(entry);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (payload: {
    project_id: string;
    employee_name: string;
    hours: number;
    worked_on: string;
    description?: string;
  }) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await api.updateTimeEntry(editing.id, payload);
        toast.success('Registro actualizado');
      } else {
        await api.createTimeEntry(payload);
        toast.success('Horas registradas');
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(getErrorMessage(e, 'No se pudo guardar el registro'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: ApiTimeEntry) => {
    if (!window.confirm(`¿Eliminar las ${formatHours(entry.hours)} h de ${entry.employee_name}?`)) {
      return;
    }
    try {
      await api.deleteTimeEntry(entry.id);
      toast.success('Registro eliminado');
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e, 'No se pudo eliminar'));
    }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">
      <section className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-3">
            <Clock className="text-accent" size={28} />
            Control de horas
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Horas introducidas a nombre de empleados externos y asignadas a proyectos existentes.
          </p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-primary">Filtros y registro</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading ? 'Cargando datos…' : `${entries.length} registros`}
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover"
            >
              <Plus size={16} />
              Añadir horas
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-slate-500 mb-1.5">Fecha inicio</span>
              <DateInput
                value={from}
                onChange={setFrom}
                max={to}
                className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-500 mb-1.5">Fecha fin</span>
              <DateInput
                value={to}
                onChange={setTo}
                min={from}
                className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Horas totales', value: formatHours(totalHours) },
          { label: 'Registros', value: String(entries.length) },
          { label: 'Empleados', value: String(employeeCount) },
          { label: 'Media horas / empleado', value: formatHours(avgHours) },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-2">
              {stat.label}
            </p>
            <p className="text-3xl font-extrabold text-primary leading-none">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm min-h-[380px]">
          <h2 className="text-lg font-bold text-primary">Horas por empleado</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">Volumen de horas en el rango seleccionado</p>
          {byEmployee.length === 0 ? (
            <p className="text-sm text-slate-400 py-16 text-center">Aún no hay horas en este periodo.</p>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer>
                <BarChart data={byEmployee.slice(0, 10)} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    angle={-15}
                    textAnchor="end"
                    interval={0}
                    height={60}
                    tickFormatter={(v) => formatLabel(String(v), 14)}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <Tooltip {...chartTooltip} formatter={(v) => [`${formatHours(Number(v))} h`, 'Horas']} />
                  <Bar dataKey="hours" fill="#7c3aed" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm min-h-[380px]">
          <h2 className="text-lg font-bold text-primary">Top proyectos</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Mayor dedicación · {topProject !== '—' ? `líder: ${topProject}` : 'sin datos'}
          </p>
          {byProject.length === 0 ? (
            <p className="text-sm text-slate-400 py-16 text-center">Sin proyectos con horas.</p>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer>
                <BarChart
                  data={byProject.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    stroke="#94a3b8"
                    tickFormatter={(v) => formatLabel(String(v), 16)}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip {...chartTooltip} formatter={(v) => [`${formatHours(Number(v))} h`, 'Horas']} />
                  <Bar dataKey="hours" fill="#22c55e" radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-primary">Registros</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cada fila es «empleado → proyecto», con descripción opcional.
          </p>
        </div>
        {entries.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            No hay registros en este rango. Pulsa «Añadir horas» para crear el primero.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-border">
                  <th className="px-5 py-3 font-semibold">Fecha</th>
                  <th className="px-5 py-3 font-semibold">Empleado</th>
                  <th className="px-5 py-3 font-semibold">Proyecto</th>
                  <th className="px-5 py-3 font-semibold">Horas</th>
                  <th className="px-5 py-3 font-semibold">Descripción</th>
                  <th className="px-5 py-3 font-semibold w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(entry.worked_on)}
                    </td>
                    <td className="px-5 py-3 font-medium text-primary">{entry.employee_name}</td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${entry.project_id}/hours`)}
                        className="text-left text-accent hover:underline"
                      >
                        {entry.project_name ?? 'Proyecto'}
                        {entry.project_sku && (
                          <span className="block text-[11px] text-slate-400 font-mono">
                            {entry.project_sku}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3 font-semibold text-primary whitespace-nowrap">
                      {formatHours(entry.hours)} h
                    </td>
                    <td className="px-5 py-3 text-slate-500 max-w-xs truncate" title={entry.description ?? ''}>
                      {entry.description || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(entry)}
                          className="p-1.5 text-slate-400 hover:text-primary rounded-md hover:bg-slate-100"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(entry)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TimeEntryModal
        open={modalOpen}
        projects={projects}
        employeeSuggestions={employeeNames}
        initial={editing}
        submitting={submitting}
        error={formError}
        onClose={() => {
          if (!submitting) {
            setModalOpen(false);
            setEditing(null);
          }
        }}
        onSubmit={(payload) => void handleSubmit(payload)}
      />
    </div>
  );
}

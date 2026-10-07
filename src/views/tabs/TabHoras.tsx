'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Pencil, Plus, Trash2 } from 'lucide-react';

import * as api from '../../api';
import type { ApiTimeEntry } from '../../api';
import { TimeEntryModal } from '../../components/modals/TimeEntryModal';
import { useAppStore } from '../../store/useAppStore';
import { formatDate } from '../../utils/dates';
import { getErrorMessage } from '../../utils/errors';
import { toast } from '../../components/ui/Toast';

function formatHours(n: number) {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

export function TabHoras({ projectId }: { projectId: string }) {
  const projects = useAppStore((s) => s.projects);
  const project = projects.find((p) => p.id === projectId);
  const [entries, setEntries] = useState<ApiTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiTimeEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await api.listTimeEntries({ project_id: projectId }));
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error cargando horas del proyecto'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalHours = useMemo(() => entries.reduce((acc, e) => acc + e.hours, 0), [entries]);
  const employeeCount = useMemo(
    () => new Set(entries.map((e) => e.employee_name.trim().toLowerCase())).size,
    [entries],
  );
  const employeeNames = useMemo(
    () => [...new Set(entries.map((e) => e.employee_name))].sort((a, b) => a.localeCompare(b, 'es')),
    [entries],
  );

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
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Clock size={18} className="text-accent" />
            Horas del proyecto
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {formatHours(totalHours)} h en {entries.length} registro{entries.length === 1 ? '' : 's'} ·{' '}
            {employeeCount} empleado{employeeCount === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormError(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover"
        >
          <Plus size={16} />
          Añadir horas
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Cargando horas…</p>
        ) : entries.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            Este proyecto aún no tiene horas registradas.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-border">
                <th className="px-5 py-3 font-semibold">Fecha</th>
                <th className="px-5 py-3 font-semibold">Empleado</th>
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
                  <td className="px-5 py-3 font-semibold text-primary whitespace-nowrap">
                    {formatHours(entry.hours)} h
                  </td>
                  <td className="px-5 py-3 text-slate-500">{entry.description || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(entry);
                          setFormError(null);
                          setModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary rounded-md hover:bg-slate-100"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(entry)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TimeEntryModal
        open={modalOpen}
        projects={project ? [project] : projects}
        employeeSuggestions={employeeNames}
        initial={editing}
        defaultProjectId={projectId}
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

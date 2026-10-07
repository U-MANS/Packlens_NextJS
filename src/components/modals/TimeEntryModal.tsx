'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Modal } from '../ui/Modal';
import { DateInput } from '../ui/DateInput';
import type { ApiTimeEntry } from '../../api';
import type { Project } from '../../types';

type Props = {
  open: boolean;
  projects: Project[];
  employeeSuggestions?: string[];
  initial?: ApiTimeEntry | null;
  defaultProjectId?: string;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    project_id: string;
    employee_name: string;
    hours: number;
    worked_on: string;
    description?: string;
  }) => void;
};

function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const inputClass =
  'w-full px-3 py-2 bg-white border border-border rounded-md text-sm text-primary placeholder:text-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

export function TimeEntryModal({
  open,
  projects,
  employeeSuggestions = [],
  initial,
  defaultProjectId,
  submitting,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [employeeName, setEmployeeName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [hours, setHours] = useState('');
  const [workedOn, setWorkedOn] = useState(todayIso());
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setEmployeeName(initial?.employee_name ?? '');
    setProjectId(initial?.project_id ?? defaultProjectId ?? '');
    setHours(initial ? String(initial.hours) : '');
    setWorkedOn(initial?.worked_on ?? todayIso());
    setDescription(initial?.description ?? '');
  }, [open, initial, defaultProjectId]);

  const projectOptions = useMemo(
    () =>
      [...projects]
        .filter((p) => !p.archived)
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [projects],
  );

  const canSubmit =
    employeeName.trim().length > 0 &&
    projectId.length > 0 &&
    Number(hours) > 0 &&
    Boolean(workedOn);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar registro de horas' : 'Añadir registro de horas'}
      description="El empleado no tiene que estar registrado en PackLens. Elige un proyecto existente."
      size="md"
      preventClose={submitting}
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting || !canSubmit}
            onClick={() =>
              onSubmit({
                project_id: projectId,
                employee_name: employeeName.trim(),
                hours: Number(hours),
                worked_on: workedOn,
                description: description.trim() || undefined,
              })
            }
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {initial ? 'Guardar cambios' : 'Añadir horas'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Empleado *
          </span>
          <input
            list="time-entry-employees"
            className={inputClass}
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            placeholder="Ej. Mario"
            disabled={submitting}
          />
          <datalist id="time-entry-employees">
            {employeeSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Proyecto *
          </span>
          <select
            className={inputClass}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={submitting || Boolean(defaultProjectId && !initial)}
          >
            <option value="">Selecciona un proyecto…</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.sku}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Horas *
            </span>
            <input
              type="number"
              min="0.25"
              max="999"
              step="0.25"
              className={inputClass}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="4"
              disabled={submitting}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Fecha *
            </span>
            <DateInput
              value={workedOn}
              onChange={setWorkedOn}
              className={inputClass}
              disabled={submitting}
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Descripción
          </span>
          <textarea
            rows={3}
            className={`${inputClass} resize-y min-h-[80px]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Qué se hizo en esas horas…"
            disabled={submitting}
          />
        </label>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

'use client';

import { Bot, User } from 'lucide-react';
import { MultiSelectDropdown } from './MultiSelectDropdown';

export type AssigneeKind = 'user' | 'agent';

type AgentOption = { id: string; name: string };

type Props = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  kind: AssigneeKind;
  onKindChange: (kind: AssigneeKind) => void;
  /** Opciones de usuarios (labels "Nombre (Rol)"). */
  userOptions: string[];
  selectedUsers: string[];
  onUsersChange: (values: string[]) => void;
  userPlaceholder: string;
  /** Agentes activos del rol correspondiente. */
  agentOptions: AgentOption[];
  selectedAgentId: string;
  onAgentChange: (id: string) => void;
  disabled?: boolean;
};

export function AssigneeField({
  label,
  required,
  hint,
  error,
  kind,
  onKindChange,
  userOptions,
  selectedUsers,
  onUsersChange,
  userPlaceholder,
  agentOptions,
  selectedAgentId,
  onAgentChange,
  disabled,
}: Props) {
  return (
    <div className="block">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        <div className="inline-flex rounded-md border border-border overflow-hidden text-[11px] font-medium">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onKindChange('user')}
            className={`inline-flex items-center gap-1 px-2 py-1 transition-colors ${
              kind === 'user' ? 'bg-accent text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <User size={12} /> Usuario
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onKindChange('agent')}
            className={`inline-flex items-center gap-1 px-2 py-1 transition-colors border-l border-border ${
              kind === 'agent' ? 'bg-accent text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Bot size={12} /> Agente
          </button>
        </div>
      </div>

      {kind === 'user' ? (
        <MultiSelectDropdown
          options={userOptions}
          selected={selectedUsers}
          placeholder={userPlaceholder}
          onChange={onUsersChange}
          disabled={disabled}
        />
      ) : (
        <select
          disabled={disabled}
          value={selectedAgentId}
          onChange={(e) => onAgentChange(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
        >
          <option value="">Selecciona un agente…</option>
          {agentOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}

      {hint && !error && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
      {error && <span className="block text-xs text-red-500 mt-1">{error}</span>}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, MoreVertical, Plus, Search, Trash2, Pencil, Power } from 'lucide-react';
import * as api from '../api';
import type { ApiAgent, AgentRole } from '../api';
import { Modal } from '../components/ui/Modal';
import { toast } from '../components/ui/Toast';
import { getErrorMessage } from '../utils/errors';
import { formatDate } from '../utils/dates';
import { useAuthStore } from '../store/useAuthStore';
import { Navigate } from 'react-router-dom';

const ROLE_COLORS: Record<AgentRole, string> = {
  Marketing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'I+D': 'bg-orange-50 text-orange-700 border-orange-200',
};

const EMPTY_FORM = {
  name: '',
  prompt: '',
  role: 'Marketing' as AgentRole,
};

type AgentRowMenuProps = {
  agent: ApiAgent;
  anchorEl: HTMLButtonElement;
  onClose: () => void;
  onEdit: (agent: ApiAgent) => void;
  onToggleStatus: (agent: ApiAgent) => void;
  onDelete: (agent: ApiAgent) => void;
};

function AgentRowMenu({
  agent,
  anchorEl,
  onClose,
  onEdit,
  onToggleStatus,
  onDelete,
}: AgentRowMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = anchorEl.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const gap = 8;
    let top = rect.bottom + gap;
    if (top + menuRect.height > window.innerHeight - gap) {
      top = Math.max(gap, rect.top - menuRect.height - gap);
    }
    const left = Math.min(
      Math.max(8, rect.right - menuRect.width),
      window.innerWidth - menuRect.width - 8,
    );
    setStyle({ position: 'fixed', top, left, zIndex: 9999 });
  }, [anchorEl]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || anchorEl.contains(target)) return;
      onClose();
    };
    const handleScroll = () => onClose();
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [anchorEl, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="w-44 bg-white border border-border rounded-lg shadow-lg py-1"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          onEdit(agent);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50"
      >
        <Pencil size={14} /> Editar
      </button>
      <button
        type="button"
        onClick={() => {
          onToggleStatus(agent);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50"
      >
        <Power size={14} />
        {agent.status === 'Activo' ? 'Desactivar' : 'Activar'}
      </button>
      <button
        type="button"
        onClick={() => {
          onDelete(agent);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50"
      >
        <Trash2 size={14} /> Eliminar
      </button>
    </div>,
    document.body,
  );
}

export default function Agents() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'Admin';

  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AgentRole | 'Todos'>('Todos');
  const [createOpen, setCreateOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<ApiAgent | null>(null);
  const [deleteAgent, setDeleteAgent] = useState<ApiAgent | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [menuAgent, setMenuAgent] = useState<ApiAgent | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listAgents();
      setAgents(list);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error cargando agentes'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const filtered = agents.filter((a) => {
    if (roleFilter !== 'Todos' && a.role !== roleFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return a.name.toLowerCase().includes(q) || a.prompt.toLowerCase().includes(q);
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  };

  const openEdit = (agent: ApiAgent) => {
    setForm({ name: agent.name, prompt: agent.prompt, role: agent.role });
    setEditAgent(agent);
    setMenuAgent(null);
    setMenuAnchor(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.prompt.trim()) {
      toast.error('Nombre y prompt son obligatorios');
      return;
    }
    setSubmitting(true);
    try {
      if (editAgent) {
        await api.updateAgent(editAgent.id, {
          name: form.name.trim(),
          prompt: form.prompt.trim(),
          role: form.role,
        });
        toast.success('Agente actualizado');
        setEditAgent(null);
      } else {
        await api.createAgent({
          name: form.name.trim(),
          prompt: form.prompt.trim(),
          role: form.role,
        });
        toast.success('Agente creado');
        setCreateOpen(false);
      }
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error guardando agente'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (agent: ApiAgent) => {
    setMenuAgent(null);
    setMenuAnchor(null);
    try {
      await api.updateAgent(agent.id, {
        status: agent.status === 'Activo' ? 'Inactivo' : 'Activo',
      });
      toast.success(agent.status === 'Activo' ? 'Agente desactivado' : 'Agente activado');
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error cambiando estado'));
    }
  };

  const handleDelete = async () => {
    if (!deleteAgent) return;
    setSubmitting(true);
    try {
      await api.deleteAgent(deleteAgent.id);
      toast.success('Agente eliminado');
      setDeleteAgent(null);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error eliminando agente'));
    } finally {
      setSubmitting(false);
    }
  };

  const formModal = (open: boolean, title: string, onClose: () => void) => (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Los agentes revisan automáticamente las fases de Marketing o I+D."
      size="lg"
      preventClose={submitting}
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSave()}
            className="px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Nombre *
          </span>
          <input
            className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Ej. Revisor Legal Pack"
            disabled={submitting}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Rol *
          </span>
          <div className="flex gap-2">
            {(['Marketing', 'I+D'] as AgentRole[]).map((role) => (
              <button
                key={role}
                type="button"
                disabled={submitting}
                onClick={() => setForm((p) => ({ ...p, role }))}
                className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                  form.role === role
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white text-slate-700 border-border hover:border-accent/40'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Prompt / instrucciones *
          </span>
          <textarea
            rows={8}
            className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-y min-h-[140px]"
            value={form.prompt}
            onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
            placeholder="Eres un revisor de packaging. Evalúa cumplimiento normativo, claims…"
            disabled={submitting}
          />
        </label>
      </div>
    </Modal>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Bot className="text-accent" size={26} />
            Agentes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Agentes de IA que revisan fases de Marketing o I+D automáticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover"
        >
          <Plus size={16} />
          Nuevo agente
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o prompt…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="flex gap-1.5">
          {(['Todos', 'Marketing', 'I+D'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                roleFilter === r
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-slate-600 border-border hover:border-accent/40'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Cargando agentes…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            No hay agentes{search || roleFilter !== 'Todos' ? ' con estos filtros' : ''}.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((agent) => (
              <li key={agent.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/80">
                <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Bot size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-primary">{agent.name}</p>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${ROLE_COLORS[agent.role]}`}
                    >
                      {agent.role}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        agent.status === 'Activo'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{agent.prompt}</p>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Actualizado {formatDate(agent.updated_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    const btn = e.currentTarget;
                    if (menuAgent?.id === agent.id) {
                      setMenuAgent(null);
                      setMenuAnchor(null);
                    } else {
                      setMenuAgent(agent);
                      setMenuAnchor(btn);
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-primary rounded-md hover:bg-slate-100 shrink-0"
                >
                  <MoreVertical size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {menuAgent && menuAnchor && (
        <AgentRowMenu
          agent={menuAgent}
          anchorEl={menuAnchor}
          onClose={() => {
            setMenuAgent(null);
            setMenuAnchor(null);
          }}
          onEdit={openEdit}
          onToggleStatus={(a) => void handleToggleStatus(a)}
          onDelete={(a) => {
            setDeleteAgent(a);
            setMenuAgent(null);
            setMenuAnchor(null);
          }}
        />
      )}

      {formModal(createOpen, 'Nuevo agente', () => setCreateOpen(false))}
      {formModal(Boolean(editAgent), 'Editar agente', () => setEditAgent(null))}

      <Modal
        open={Boolean(deleteAgent)}
        onClose={() => setDeleteAgent(null)}
        title="Eliminar agente"
        description={
          deleteAgent
            ? `¿Eliminar «${deleteAgent.name}»? Los proyectos que lo tengan asignado dejarán de usarlo.`
            : undefined
        }
        preventClose={submitting}
        footer={
          <>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setDeleteAgent(null)}
              className="px-4 py-2 rounded-md border border-border text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleDelete()}
              className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              Eliminar
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  );
}

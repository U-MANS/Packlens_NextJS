import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Mail,
  MoreVertical,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  Users as UsersIcon,
} from 'lucide-react';
import * as api from '../api';
import type { ApiUser } from '../api/mappers';
import { Modal } from '../components/ui/Modal';
import { toast } from '../components/ui/Toast';
import { getErrorMessage } from '../utils/errors';
import { formatDate } from '../utils/dates';
import { useAuthStore } from '../store/useAuthStore';
import type { Role } from '../types';
import InvitationsPanel from './InvitationsPanel';

type Dept = Role;
type UserStatus = 'Activo' | 'Inactivo';

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Dept;
  status: UserStatus;
  initials: string;
  avatarColor: string;
  joinedAt: string;
}

const DEPT_COLORS: Record<Dept, string> = {
  Marketing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Diseño: 'bg-purple-50 text-purple-700 border-purple-200',
  'I+D': 'bg-orange-50 text-orange-700 border-orange-200',
  Comercial: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Admin: 'bg-slate-100 text-slate-600 border-slate-200',
};

const AVATAR_COLORS: Record<Dept, string> = {
  Marketing: 'bg-indigo-100 text-indigo-700',
  Diseño: 'bg-purple-100 text-purple-700',
  'I+D': 'bg-orange-100 text-orange-700',
  Comercial: 'bg-emerald-100 text-emerald-700',
  Admin: 'bg-slate-200 text-slate-700',
};

const ALL_DEPTS: Dept[] = ['Marketing', 'Diseño', 'I+D', 'Comercial', 'Admin'];

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'Marketing' as Dept,
};

function initialsFromName(name: string, initials?: string | null) {
  if (initials?.trim()) return initials.trim().toUpperCase();
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function mapAppUser(u: ApiUser): AppUser {
  const role = u.role as Dept;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role,
    status: u.status as UserStatus,
    initials: initialsFromName(u.name, u.initials),
    avatarColor: AVATAR_COLORS[role] ?? 'bg-slate-100 text-slate-700',
    joinedAt: u.joined_at ?? u.created_at,
  };
}

/** Presencia en la app: solo el usuario con sesión abierta aparece como Activo. */
function getPresence(user: AppUser, currentUserId?: string): 'Activo' | 'Ausente' {
  if (user.status !== 'Activo' || !currentUserId) return 'Ausente';
  return user.id === currentUserId ? 'Activo' : 'Ausente';
}

interface UserRowMenuProps {
  user: AppUser;
  anchorEl: HTMLButtonElement | null;
  isSelf: boolean;
  onClose: () => void;
  onOpenRoleModal: (user: AppUser) => void;
  onOpenDeleteModal: (user: AppUser) => void;
  onToggleStatus: (user: AppUser) => void;
}

function UserRowMenu({
  user,
  anchorEl,
  isSelf,
  onClose,
  onOpenRoleModal,
  onOpenDeleteModal,
  onToggleStatus,
}: UserRowMenuProps) {
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
    const left = Math.min(Math.max(8, rect.right - menuRect.width), window.innerWidth - menuRect.width - 8);
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
    disabled = false,
  ) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        action();
        onClose();
      }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100'
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
      className="w-52 bg-white border border-border rounded-xl shadow-lg py-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {item(<UserCog size={15} className="text-slate-400" />, 'Cambiar rol', () => onOpenRoleModal(user))}
      <div className="border-t border-border my-1" />
      {user.status === 'Activo'
        ? item(
            <UserMinus size={15} />,
            'Desactivar usuario',
            () => onToggleStatus(user),
            false,
            isSelf,
          )
        : item(<UserPlus size={15} />, 'Reactivar usuario', () => onToggleStatus(user))}
      <div className="border-t border-border my-1" />
      {item(<Trash2 size={15} />, 'Eliminar usuario', () => onOpenDeleteModal(user), true, isSelf)}
    </div>,
    document.body,
  );
}

export default function Users() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'Admin';
  const [activeTab, setActiveTab] = useState<'team' | 'invitations'>('team');

  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<Dept | 'Todos'>('Todos');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [roleModalUser, setRoleModalUser] = useState<AppUser | null>(null);
  const [roleDraft, setRoleDraft] = useState<Dept>('Marketing');
  const [deleteModalUser, setDeleteModalUser] = useState<AppUser | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data.map(mapAppUser));
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error cargando usuarios'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [openMenuId]);

  const updateUserInList = (updated: ApiUser) => {
    const mapped = mapAppUser(updated);
    setUsers((prev) =>
      prev.map((u) => (u.id === mapped.id ? mapped : u)).sort((a, b) => a.name.localeCompare(b.name)),
    );
  };

  const handleRoleChange = async () => {
    if (!roleModalUser || roleDraft === roleModalUser.role) {
      setRoleModalUser(null);
      return;
    }
    setIsSavingRole(true);
    try {
      const updated = await api.updateUser(roleModalUser.id, { role: roleDraft });
      updateUserInList(updated);
      toast.success(`Rol de ${roleModalUser.name} actualizado a ${roleDraft}`);
      setRoleModalUser(null);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error al cambiar el rol'));
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModalUser) return;
    setIsDeleting(true);
    try {
      await api.deleteUser(deleteModalUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteModalUser.id));
      toast.success(`${deleteModalUser.name} eliminado correctamente`);
      setDeleteModalUser(null);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error al eliminar usuario'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (user: AppUser) => {
    if (user.id === currentUser?.id && user.status === 'Activo') {
      toast.error('No puedes desactivar tu propia cuenta');
      return;
    }
    try {
      if (user.status === 'Activo') {
        const updated = await api.updateUser(user.id, { status: 'Inactivo' });
        updateUserInList(updated);
        toast.success('Usuario desactivado. Ya no podrá iniciar sesión.');
      } else {
        const updated = await api.updateUser(user.id, { status: 'Activo' });
        updateUserInList(updated);
        toast.success('Usuario reactivado');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error al actualizar el estado'));
    }
  };

  const filtered = users.filter((u) => {
    const matchesDept = deptFilter === 'Todos' || u.role === deptFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q);
    return matchesDept && matchesSearch;
  });

  const countByDept = (dept: Dept) => users.filter((u) => u.role === dept).length;
  const onlineCount = users.filter((u) => getPresence(u, currentUser?.id) === 'Activo').length;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await api.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        status: 'Activo',
      });
      setUsers((prev) => [...prev, mapAppUser(created)].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Usuario creado correctamente');
      setShowAddModal(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error al crear usuario'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-border px-8 pt-8 pb-6 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Usuarios</h1>
            <p className="text-sm text-slate-500 mt-1">
              Directorio del equipo · {users.length} usuarios · {onlineCount} en línea
            </p>
          </div>
          {isAdmin && activeTab === 'team' ? (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              <Plus size={16} /> Añadir usuario
            </button>
          ) : !isAdmin ? (
            <button
              type="button"
              disabled
              title="Solo los administradores pueden añadir usuarios"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold opacity-70 cursor-not-allowed"
            >
              <Plus size={16} /> Añadir usuario
            </button>
          ) : null}
        </div>

        {isAdmin && (
          <div className="mt-5 flex gap-2 border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                activeTab === 'team'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-slate-500 hover:text-primary'
              }`}
            >
              Equipo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invitations')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                activeTab === 'invitations'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-slate-500 hover:text-primary'
              }`}
            >
              <Mail size={14} />
              Invitaciones
            </button>
          </div>
        )}

        {activeTab === 'team' && (
        <div className="mt-5 flex gap-4 flex-wrap">
          {ALL_DEPTS.map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setDeptFilter(deptFilter === dept ? 'Todos' : dept)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                deptFilter === dept
                  ? DEPT_COLORS[dept]
                  : 'bg-white border-border text-slate-500 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {dept}
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  deptFilter === dept ? 'bg-white/50' : 'bg-slate-100'
                }`}
              >
                {countByDept(dept)}
              </span>
            </button>
          ))}
          {deptFilter !== 'Todos' && (
            <button
              type="button"
              onClick={() => setDeptFilter('Todos')}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Ver todos
            </button>
          )}
        </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-8">
        {activeTab === 'invitations' && isAdmin ? (
          <div className="max-w-5xl mx-auto">
            <InvitationsPanel />
          </div>
        ) : (
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nombre, email o departamento…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-border rounded-lg text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>

          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center text-slate-400 gap-2">
                <UsersIcon size={32} className="opacity-30 animate-pulse" />
                <p className="text-sm">Cargando usuarios…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 flex flex-col items-center text-slate-400 gap-2">
                <UsersIcon size={32} className="opacity-30" />
                <p className="text-sm">
                  {users.length === 0 ? 'No hay usuarios registrados' : `Sin resultados para "${search}"`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] table-fixed text-left">
                  <colgroup>
                    <col className="w-14" />
                    <col className="w-[28%]" />
                    <col className="w-[30%]" />
                    <col className="w-[18%]" />
                    <col className="w-[14%]" />
                    {isAdmin && <col className="w-12" />}
                  </colgroup>
                  <thead className="bg-slate-50 border-b border-border">
                    <tr className="text-xs uppercase tracking-wide font-semibold text-slate-400">
                      <th className="px-5 py-3" aria-hidden />
                      <th className="px-4 py-3 font-semibold">Nombre</th>
                      <th className="px-4 py-3 font-semibold">Correo</th>
                      <th className="px-4 py-3 font-semibold">Departamento</th>
                      <th className="px-4 py-3 font-semibold">Presencia</th>
                      {isAdmin && <th className="px-4 py-3" aria-label="Acciones" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((user) => {
                      const presence = getPresence(user, currentUser?.id);
                      const isOnline = presence === 'Activo';
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/70 transition-colors group">
                          <td className="px-5 py-4 align-middle">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${user.avatarColor}`}
                            >
                              {user.initials}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-middle min-w-0">
                            <p className="text-sm font-semibold text-primary truncate">{user.name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Desde {formatDate(user.joinedAt)}
                            </p>
                          </td>
                          <td className="px-4 py-4 align-middle min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Mail size={13} className="text-slate-400 shrink-0" />
                              <a
                                href={`mailto:${user.email}`}
                                className="text-sm text-slate-600 truncate hover:text-accent transition-colors"
                              >
                                {user.email}
                              </a>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${DEPT_COLORS[user.role]}`}
                            >
                              {user.role === 'Admin' && <Shield size={11} />}
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                isOnline ? 'text-emerald-600' : 'text-slate-400'
                              }`}
                              title={isOnline ? 'Conectado ahora en la app' : 'No conectado'}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                                }`}
                              />
                              {presence}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-4 align-middle text-right relative">
                              <button
                                ref={(el) => {
                                  menuButtonRefs.current[user.id] = el;
                                }}
                                type="button"
                                title="Opciones de administrador"
                                onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                                className={`p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all ${
                                  openMenuId === user.id
                                    ? 'opacity-100 bg-slate-100'
                                    : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                <MoreVertical size={15} />
                              </button>
                              {openMenuId === user.id && (
                                <UserRowMenu
                                  user={user}
                                  anchorEl={menuButtonRefs.current[user.id]}
                                  isSelf={user.id === currentUser?.id}
                                  onClose={() => setOpenMenuId(null)}
                                  onOpenRoleModal={(u) => {
                                    setRoleModalUser(u);
                                    setRoleDraft(u.role);
                                  }}
                                  onOpenDeleteModal={setDeleteModalUser}
                                  onToggleStatus={handleToggleStatus}
                                />
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-5 py-3 bg-slate-50 border-t border-border flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {filtered.length} de {users.length} usuarios
              </p>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <UserCheck size={13} className="text-emerald-500" />
                {onlineCount} en línea
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      <Modal
        open={showAddModal}
        onClose={() => {
          if (!isSubmitting) {
            setShowAddModal(false);
            setForm(EMPTY_FORM);
          }
        }}
        title="Añadir usuario"
        description="Se creará la cuenta en Supabase Auth y el perfil en PackLens."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="add-user-form"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'Creando…' : 'Crear usuario'}
            </button>
          </div>
        }
      >
        <form id="add-user-form" onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label htmlFor="user-name" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Nombre
            </label>
            <input
              id="user-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div>
            <label htmlFor="user-email" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Email
            </label>
            <input
              id="user-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div>
            <label htmlFor="user-password" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Contraseña temporal
            </label>
            <input
              id="user-password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div>
            <label htmlFor="user-role" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Rol / departamento
            </label>
            <select
              id="user-role"
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Dept }))}
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {ALL_DEPTS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!roleModalUser}
        onClose={() => {
          if (!isSavingRole) setRoleModalUser(null);
        }}
        title="Cambiar rol"
        description={roleModalUser ? `Actualizar el departamento de ${roleModalUser.name}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRoleModalUser(null)}
              disabled={isSavingRole}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRoleChange}
              disabled={isSavingRole || roleDraft === roleModalUser?.role}
              className="px-4 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              {isSavingRole ? 'Guardando…' : 'Guardar rol'}
            </button>
          </div>
        }
      >
        <div>
          <label htmlFor="edit-user-role" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Rol / departamento
          </label>
          <select
            id="edit-user-role"
            value={roleDraft}
            onChange={(e) => setRoleDraft(e.target.value as Dept)}
            className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            {ALL_DEPTS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </Modal>

      <Modal
        open={!!deleteModalUser}
        onClose={() => {
          if (!isDeleting) setDeleteModalUser(null);
        }}
        title="Eliminar usuario"
        description={
          deleteModalUser
            ? `¿Eliminar a ${deleteModalUser.name} (${deleteModalUser.email})? Se borrará de Supabase Auth y del directorio. Esta acción no se puede deshacer.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteModalUser(null)}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {isDeleting ? 'Eliminando…' : 'Eliminar definitivamente'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          El perfil en PackLens y la cuenta de autenticación se eliminarán por completo.
        </p>
      </Modal>
    </div>
  );
}

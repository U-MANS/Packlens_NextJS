import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Send, Shield, Trash2, Mail } from 'lucide-react';
import * as api from '../api';
import type { ApiInvitation } from '../api';
import { Modal } from '../components/ui/Modal';
import { toast } from '../components/ui/Toast';
import { getErrorMessage } from '../utils/errors';
import { formatDateTime as formatDate } from '../utils/dates';
import type { Role } from '../types';

const ALL_ROLES: Role[] = ['Marketing', 'Diseño', 'I+D', 'Comercial', 'Admin'];

const EMPTY_FORM = {
  email: '',
  name: '',
  role: 'Marketing' as Role,
};

function statusLabel(status: string) {
  if (status === 'pending') return 'Pendiente';
  if (status === 'accepted') return 'Aceptada';
  if (status === 'revoked') return 'Revocada';
  return status;
}

function statusClass(status: string) {
  if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'accepted') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export default function InvitationsPanel() {
  const [invitations, setInvitations] = useState<ApiInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.listInvitations();
      setInvitations(data);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error cargando invitaciones'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await api.createInvitation({
        email: form.email.trim(),
        role: form.role,
        name: form.name.trim() || undefined,
      });
      setInvitations((prev) => [result.invitation, ...prev]);
      if (result.email_sent) {
        toast.success('Invitación enviada por correo');
      } else {
        toast.error(
          result.email_error
            ? `No se pudo enviar el correo: ${result.email_error}`
            : 'Invitación creada, pero no se pudo enviar el correo. Revisa la configuración de email.',
        );
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Error al enviar invitación'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (invitation: ApiInvitation) => {
    setResendingId(invitation.id);
    try {
      const result = await api.resendInvitation(invitation.id);
      setInvitations((prev) =>
        prev.map((item) => (item.id === invitation.id ? result.invitation : item)),
      );
      if (result.email_sent) {
        toast.success('Invitación reenviada por correo');
      } else {
        toast.error(result.email_error ?? 'No se pudo reenviar el correo');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Error al reenviar'));
    } finally {
      setResendingId(null);
    }
  };

  const handleRevoke = async (invitation: ApiInvitation) => {
    setRevokingId(invitation.id);
    try {
      await api.revokeInvitation(invitation.id);
      setInvitations((prev) => prev.filter((item) => item.id !== invitation.id));
      toast.success('Invitación revocada');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Error al revocar'));
    } finally {
      setRevokingId(null);
    }
  };

  const pendingCount = invitations.filter((i) => i.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-600">
            Envía un enlace de registro por correo con el rol ya asignado.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {pendingCount} invitación{pendingCount === 1 ? '' : 'es'} pendiente{pendingCount === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors shrink-0"
        >
          <Send size={16} /> Invitar por email
        </button>
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center text-slate-400 gap-2">
            <Mail size={32} className="opacity-30 animate-pulse" />
            <p className="text-sm">Cargando invitaciones…</p>
          </div>
        ) : invitations.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-slate-400 gap-2">
            <Mail size={32} className="opacity-30" />
            <p className="text-sm">No hay invitaciones enviadas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-slate-50 border-b border-border">
                <tr className="text-xs uppercase tracking-wide font-semibold text-slate-400">
                  <th className="px-5 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Expira</th>
                  <th className="px-4 py-3">Invitado por</th>
                  <th className="px-4 py-3 w-28" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invitations.map((invitation) => (
                  <tr key={invitation.id} className="text-sm">
                    <td className="px-5 py-3">
                      <div className="font-medium text-primary">{invitation.email}</div>
                      {invitation.name && (
                        <div className="text-xs text-slate-400">{invitation.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold bg-slate-50 text-slate-600 border-slate-200">
                        {invitation.role === 'Admin' && <Shield size={11} />}
                        {invitation.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-semibold ${statusClass(invitation.status)}`}
                      >
                        {statusLabel(invitation.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatDate(invitation.expires_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {invitation.invited_by_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {invitation.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Reenviar invitación"
                            disabled={resendingId === invitation.id}
                            onClick={() => void handleResend(invitation)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-40"
                          >
                            <RefreshCw size={15} className={resendingId === invitation.id ? 'animate-spin' : ''} />
                          </button>
                          <button
                            type="button"
                            title="Revocar invitación"
                            disabled={revokingId === invitation.id}
                            onClick={() => void handleRevoke(invitation)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => {
          if (!isSubmitting) {
            setShowModal(false);
            setForm(EMPTY_FORM);
          }
        }}
        title="Invitar por email"
        description="La persona recibirá un enlace para registrarse con el rol que elijas."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="invite-form"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </div>
        }
      >
        <form id="invite-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="invite-email" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="persona@empresa.com"
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div>
            <label htmlFor="invite-name" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Nombre (opcional)
            </label>
            <input
              id="invite-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Se puede completar al registrarse"
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Rol asignado
            </label>
            <select
              id="invite-role"
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))}
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}

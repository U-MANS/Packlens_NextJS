import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { previewInvite } from '../api';
import type { InvitePreview } from '../api';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { getErrorMessage } from '../utils/errors';

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { acceptInvite, isLoading, error, clearError, user } = useAuthStore();
  const bootstrap = useAppStore((s) => s.bootstrap);

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!token) {
      setLoadError('Enlace de invitación inválido');
      setIsLoadingPreview(false);
      return;
    }
    setIsLoadingPreview(true);
    previewInvite(token)
      .then((data) => {
        setPreview(data);
        if (data.name) setName(data.name);
      })
      .catch((e) => setLoadError(getErrorMessage(e, 'Invitación no válida')))
      .finally(() => setIsLoadingPreview(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setFormError(null);

    if (password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Las contraseñas no coinciden');
      return;
    }
    const finalName = (name || preview?.name || '').trim();
    if (finalName.length < 2) {
      setFormError('El nombre es obligatorio');
      return;
    }
    if (!token) return;

    try {
      await acceptInvite(token, { password, name: finalName });
      await bootstrap();
      navigate('/', { replace: true });
    } catch {
      // error inline via store
    }
  };

  if (isLoadingPreview) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
        <p className="text-slate-500 text-sm">Verificando invitación…</p>
      </div>
    );
  }

  if (loadError || !preview) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center text-red-600 text-2xl font-bold mx-auto">
            !
          </div>
          <h1 className="text-xl font-bold text-primary">Invitación no válida</h1>
          <p className="text-slate-600 text-sm">{loadError ?? 'Este enlace ha expirado o ya fue utilizado.'}</p>
          <Link to="/login" className="text-accent text-sm font-medium hover:underline">
            Ir al login
          </Link>
        </div>
      </div>
    );
  }

  const nameLocked = Boolean(preview.name);

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            P
          </div>
          <h1 className="text-2xl font-bold text-primary">Únete a PackLens</h1>
          <p className="text-slate-500 text-sm mt-1">
            {preview.inviter_name} te ha invitado como <strong>{preview.role}</strong>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={preview.email}
              readOnly
              className="w-full px-3 py-2 bg-slate-50 border border-border rounded-md text-sm text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Rol asignado
            </label>
            <input
              type="text"
              value={preview.role}
              readOnly
              className="w-full px-3 py-2 bg-slate-50 border border-border rounded-md text-sm text-slate-500"
            />
          </div>

          <div>
            <label htmlFor="invite-user-name" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Nombre
            </label>
            <input
              id="invite-user-name"
              type="text"
              required
              minLength={2}
              readOnly={nameLocked}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre completo"
              className={`w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 ${nameLocked ? 'bg-slate-50 text-slate-500' : 'bg-white'}`}
            />
          </div>

          <div>
            <label htmlFor="invite-password" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Contraseña
            </label>
            <input
              id="invite-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label htmlFor="invite-confirm-password" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Confirmar contraseña
            </label>
            <input
              id="invite-confirm-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {(formError || error) && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {formError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-md bg-accent text-white font-semibold text-sm hover:bg-accent-hover transition-colors disabled:opacity-60"
          >
            {isLoading ? 'Creando cuenta…' : 'Crear cuenta y entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-accent font-medium hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

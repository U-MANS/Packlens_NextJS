import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Role } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';

const ROLES: Role[] = ['Marketing', 'Diseño', 'I+D', 'Admin', 'Comercial'];

const debugSignupEnabled =
  process.env.NEXT_PUBLIC_DEBUG_SIGNUP === 'true' || process.env.NODE_ENV === 'development';

export default function RegisterDebug() {
  const navigate = useNavigate();
  const { registerDebug, isLoading, error, clearError, user } = useAuthStore();
  const bootstrap = useAppStore((s) => s.bootstrap);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  if (!debugSignupEnabled) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <p className="text-slate-600">Registro debug no disponible.</p>
          <Link to="/login" className="text-accent text-sm font-medium hover:underline">
            Volver al login
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    const role = String(fd.get('role') ?? 'Marketing') as Role;

    try {
      await registerDebug({ name, email, password, role });
      await bootstrap();
      navigate('/', { replace: true });
    } catch {
      // error inline
    }
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-amber-500 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            P
          </div>
          <h1 className="text-2xl font-bold text-primary">Registro debug</h1>
          <p className="text-slate-500 text-sm mt-1">Solo desarrollo — crea tu cuenta con tu email real</p>
        </div>

        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          El usuario se crea en Supabase Auth con email confirmado. No uses esto en producción.
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4"
        >
          <div>
            <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Tu nombre"
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu@gmail.com"
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Rol
            </label>
            <select
              id="role"
              name="role"
              defaultValue="Marketing"
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
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

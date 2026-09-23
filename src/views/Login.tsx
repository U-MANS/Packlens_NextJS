import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError, user } = useAuthStore();
  const bootstrap = useAppStore((s) => s.bootstrap);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');
    try {
      await login(email, password);
      await bootstrap();
      navigate(from, { replace: true });
    } catch {
      // El error se muestra inline desde useAuthStore
    }
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            P
          </div>
          <h1 className="text-2xl font-bold text-primary">PackLens</h1>
          <p className="text-slate-500 text-sm mt-1">Gestión de packaging — WeWork Factory</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4"
        >
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
              placeholder="tu@wework.factory"
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
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
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
            {isLoading ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Usa las credenciales de tu cuenta Supabase Auth
        </p>

        {(process.env.NEXT_PUBLIC_DEBUG_SIGNUP === 'true' || process.env.NODE_ENV === 'development') && (
          <p className="text-center text-sm mt-3">
            <Link to="/register-debug" className="text-accent font-medium hover:underline">
              Registro debug (desarrollo)
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

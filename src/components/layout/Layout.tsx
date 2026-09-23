import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, BookOpen, Bell, Search, User, Users, LogOut, Sparkles, Megaphone } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Toaster } from '../ui/Toast';
import { NotificationPanel } from './NotificationPanel';
import type { Role } from '../../types';
const ROLES: Role[] = ['Marketing', 'Diseño', 'I+D', 'Admin', 'Comercial'];

const Layout = () => {
  const activeRole = useAppStore((s) => s.activeRole);
  const setActiveRole = useAppStore((s) => s.setActiveRole);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const refreshUnreadCount = useNotificationStore((s) => s.refreshUnreadCount);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  useEffect(() => {
    void refreshUnreadCount();
    const interval = setInterval(() => void refreshUnreadCount(), 30_000);
    const onFocus = () => void refreshUnreadCount();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshUnreadCount]);

  const handleToggleNotifications = () => {
    setNotifPanelOpen((prev) => !prev);
  };
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'Admin';

  return (
    <div className="flex h-screen bg-secondary overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-border flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <NavLink
            to="/"
            title="Ir al dashboard"
            className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white">
              P
            </div>
            PackLens
          </NavLink>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <FolderKanban size={18} />
            Proyectos
          </NavLink>
          <NavLink
            to="/library"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <BookOpen size={18} />
            Biblioteca
          </NavLink>
          <NavLink
            to="/moodboard"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Sparkles size={18} />
            Moodboard
          </NavLink>
          <NavLink
            to="/campaigns"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Megaphone size={18} />
            Campañas
          </NavLink>
          {/* Tareas y Ajustes ocultos temporalmente */}

          <div className="pt-3 mt-3 border-t border-border">
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Users size={18} />
              Usuarios
            </NavLink>
          </div>
        </nav>

        <div className="p-4 border-t border-border text-xs text-slate-400">
          PackLens Prototype MVP v1.0
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-8">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar proyectos, documentos..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-md text-sm focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            {user && (
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-primary">{user.name}</p>
                {isAdmin ? (
                  <select
                    value={activeRole}
                    onChange={(e) => setActiveRole(e.target.value as Role)}
                    title="Simular vista por rol"
                    className="mt-0.5 text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded px-2 py-0.5 cursor-pointer hover:border-accent focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-slate-500">{activeRole}</p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleToggleNotifications}
              title="Notificaciones"
              className="relative p-1 text-slate-400 hover:text-primary transition-colors"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-surface flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
            >
              <LogOut size={18} />
            </button>

            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-sm border border-indigo-200">
              {user?.initials ?? <User size={16} />}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <Toaster />
      <NotificationPanel open={notifPanelOpen} onClose={() => setNotifPanelOpen(false)} />
    </div>  );
};

export default Layout;

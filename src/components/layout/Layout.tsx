import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  Bell,
  User,
  Users,
  LogOut,
  Sparkles,
  Megaphone,
  Bot,
  Clock,
  Settings2,
  Menu,
  X,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { ThemeToggle } from '../theme/ThemeToggle';
import { Toaster } from '../ui/Toast';
import { GlobalSearch } from './GlobalSearch';
import { NotificationPanel } from './NotificationPanel';
import { enabledNavItems } from '../../lib/tenant/config';
import { PACKAGING_HELIOS } from '../../lib/tenant/templates/helios';
import { isOpsAdminRole, type Role } from '../../types';

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  library: BookOpen,
  moodboard: Sparkles,
  campaigns: Megaphone,
  hours: Clock,
  users: Users,
  agents: Bot,
  'org-settings': Settings2,
};

const Layout = () => {
  const activeRole = useAppStore((s) => s.activeRole);
  const setActiveRole = useAppStore((s) => s.setActiveRole);
  const {
    user,
    logout,
    organization,
    tenantConfig,
    availableOrganizations,
    isPlatformAdmin,
    setOrganizationId,
  } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const refreshUnreadCount = useNotificationStore((s) => s.refreshUnreadCount);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [switchingOrg, setSwitchingOrg] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const config = tenantConfig || PACKAGING_HELIOS;
  const roleForNav = isOpsAdminRole(user?.role) ? activeRole : user?.role;
  const navItems = useMemo(
    () => enabledNavItems(config, user?.role),
    [config, user?.role]
  );
  const roles = useMemo(
    () =>
      (config.roles?.length
        ? config.roles.map((r) => r.id)
        : ['Marketing', 'Diseño', 'I+D', 'Admin', 'Manager', 'Comercial']) as Role[],
    [config]
  );

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

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  const handleToggleNotifications = () => {
    setNotifPanelOpen((prev) => !prev);
  };
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const canSimulateRoles = isOpsAdminRole(user?.role);
  const brandName = organization?.name || 'PackLens';
  const showTenantSwitcher = isPlatformAdmin
    ? availableOrganizations.length > 0
    : availableOrganizations.length > 1;

  const handleTenantChange = async (orgId: string) => {
    if (!orgId || orgId === organization?.id) return;
    setSwitchingOrg(true);
    try {
      await setOrganizationId(orgId);
      navigate('/');
    } finally {
      setSwitchingOrg(false);
    }
  };

  const renderNavLinks = (adminOnly: boolean) =>
    navItems
      .filter((item) => Boolean(item.adminOnly) === adminOnly)
      .map((item) => {
        const Icon = NAV_ICONS[item.id] || (adminOnly ? Settings2 : FolderKanban);
        const to = item.path === '/dashboard' ? '/' : item.path;
        return (
          <NavLink
            key={item.id}
            to={to}
            end={to === '/'}
            onClick={() => setNavOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Icon size={18} />
            {item.label}
          </NavLink>
        );
      });

  return (
    <div className="flex h-screen bg-secondary overflow-hidden">
      {navOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          aria-label="Cerrar menú"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 max-w-[85vw] bg-surface border-r border-border flex flex-col transform transition-transform duration-200 ease-out lg:static lg:translate-x-0 lg:max-w-none ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navegación principal"
      >
        <div className="h-16 flex items-center justify-between gap-2 px-4 sm:px-6 border-b border-border">
          <NavLink
            to="/"
            title="Ir al dashboard"
            onClick={() => setNavOpen(false)}
            className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight hover:opacity-90 transition-opacity min-w-0"
          >
            <div className="w-8 h-8 shrink-0 rounded-lg bg-accent flex items-center justify-center text-white">
              {brandName.charAt(0).toUpperCase()}
            </div>
            <span className="truncate">{brandName}</span>
          </NavLink>
          <button
            type="button"
            className="lg:hidden p-2 text-slate-400 hover:text-primary rounded-md"
            aria-label="Cerrar menú"
            onClick={() => setNavOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {renderNavLinks(false)}

          {navItems.some((item) => item.adminOnly) && (
            <div className="pt-3 mt-3 border-t border-border space-y-1">
              {renderNavLinks(true)}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-border text-xs text-slate-400">
          PackLens · {organization?.slug || 'tenant'}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 w-full">
        <header className="h-16 bg-surface border-b border-border flex items-center justify-between gap-2 px-3 sm:px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              className="lg:hidden p-2 -ml-1 text-slate-500 hover:text-primary rounded-md shrink-0"
              aria-label="Abrir menú"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <Menu size={20} />
            </button>
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {user && (
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-primary">{user.name}</p>
                <div className="mt-0.5 flex items-center justify-end gap-1.5 flex-wrap">
                  {showTenantSwitcher && (
                    <select
                      value={organization?.id || ''}
                      disabled={switchingOrg}
                      onChange={(e) => void handleTenantChange(e.target.value)}
                      title="Cambiar de tenant / cliente"
                      aria-label="Cambiar de tenant o cliente"
                      className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded px-2 py-0.5 cursor-pointer hover:border-accent focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-60 max-w-[140px]"
                    >
                      {availableOrganizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {canSimulateRoles ? (
                    <select
                      value={activeRole}
                      onChange={(e) => setActiveRole(e.target.value as Role)}
                      title="Simular vista por rol"
                      aria-label="Simular vista por rol"
                      className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded px-2 py-0.5 cursor-pointer hover:border-accent focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-slate-500">{roleForNav}</p>
                  )}
                </div>
              </div>
            )}

            <ThemeToggle />
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

        <main className="flex-1 overflow-auto min-w-0">
          <Outlet />
        </main>
      </div>

      <Toaster />
      <NotificationPanel open={notifPanelOpen} onClose={() => setNotifPanelOpen(false)} />
    </div>
  );
};

export default Layout;

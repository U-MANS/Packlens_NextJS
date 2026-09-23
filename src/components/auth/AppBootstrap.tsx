import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useNotificationStore } from '../../store/useNotificationStore';

/** Carga datos iniciales del API cuando hay sesión activa. */
export function AppBootstrap() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const isBootstrapped = useAppStore((s) => s.isBootstrapped);

  useEffect(() => {
    if (isHydrated && user && !isBootstrapped) {
      bootstrap();
    }
  }, [isHydrated, user, isBootstrapped, bootstrap]);

  useEffect(() => {
    if (!user) return;
    const { refreshUnreadCount } = useNotificationStore.getState();
    void refreshUnreadCount();
  }, [user?.id]);

  return <Outlet />;
}

import { create } from 'zustand';
import * as api from '../api';
import { getErrorMessage } from '../utils/errors';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  project_id: string | null;
  read_at: string | null;
  created_at: string;
  is_read: boolean;
}

interface NotificationState {
  items: AppNotification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const data = await api.listNotifications();
      set({
        items: data.items,
        unreadCount: data.unread_count,
        isLoading: false,
      });
    } catch (e) {
      set({ isLoading: false });
      console.error(getErrorMessage(e, 'Error cargando notificaciones'));
    }
  },

  refreshUnreadCount: async () => {
    try {
      const data = await api.listNotifications(1);
      set({ unreadCount: data.unread_count });
    } catch {
      /* silencioso en polling */
    }
  },

  markAllRead: async () => {
    try {
      await api.markAllNotificationsRead();
      set((s) => ({
        unreadCount: 0,
        items: s.items.map((n) => ({
          ...n,
          is_read: true,
          read_at: n.read_at ?? new Date().toISOString(),
        })),
      }));
    } catch (e) {
      console.error(getErrorMessage(e, 'Error marcando notificaciones'));
    }
  },
}));

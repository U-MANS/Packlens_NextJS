import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as api from '../api';
import { setTokenRefreshHandler, ApiError } from '../api/client';
import type { Role } from '../types';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  registerDebug: (payload: {
    name: string;
    email: string;
    password: string;
    role: string;
    initials?: string;
  }) => Promise<void>;
  acceptInvite: (token: string, payload: { password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isHydrated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const tokens = await api.login(email, password);
          set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          });
          const me = await api.getMe();
          set({
            user: {
              id: me.id,
              name: me.name,
              email: me.email,
              role: me.role as Role,
              initials: me.initials ?? undefined,
            },
            isLoading: false,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error de autenticación';
          set({ isLoading: false, error: msg, accessToken: null, refreshToken: null, user: null });
          throw e;
        }
      },

      registerDebug: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const tokens = await api.debugRegister(payload);
          set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          });
          const me = await api.getMe();
          set({
            user: {
              id: me.id,
              name: me.name,
              email: me.email,
              role: me.role as Role,
              initials: me.initials ?? undefined,
            },
            isLoading: false,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error al registrar';
          set({ isLoading: false, error: msg, accessToken: null, refreshToken: null, user: null });
          throw e;
        }
      },

      acceptInvite: async (token, payload) => {
        set({ isLoading: true, error: null });
        try {
          const tokens = await api.acceptInvite(token, payload);
          set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          });
          const me = await api.getMe();
          set({
            user: {
              id: me.id,
              name: me.name,
              email: me.email,
              role: me.role as Role,
              initials: me.initials ?? undefined,
            },
            isLoading: false,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error al aceptar invitación';
          set({ isLoading: false, error: msg, accessToken: null, refreshToken: null, user: null });
          throw e;
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          if (refreshToken) await api.logoutApi(refreshToken);
        } catch {
          // ignore
        }
        set({ accessToken: null, refreshToken: null, user: null });
      },

      restoreSession: async () => {
        const { accessToken, refreshToken } = get();
        if (!accessToken && !refreshToken) {
          set({ isHydrated: true });
          return false;
        }
        set({ isLoading: true });
        try {
          if (accessToken) {
            try {
              const me = await api.getMe();
              set({
                user: {
                  id: me.id,
                  name: me.name,
                  email: me.email,
                  role: me.role as Role,
                  initials: me.initials ?? undefined,
                },
                isLoading: false,
                isHydrated: true,
              });
              return true;
            } catch (e) {
              const expired =
                e instanceof ApiError && e.status === 401 && Boolean(refreshToken);
              if (!expired) throw e;
            }
          }

          if (refreshToken) {
            const tokens = await api.refreshToken(refreshToken);
            set({
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
            });
            const me = await api.getMe();
            set({
              user: {
                id: me.id,
                name: me.name,
                email: me.email,
                role: me.role as Role,
                initials: me.initials ?? undefined,
              },
              isLoading: false,
              isHydrated: true,
            });
            return true;
          }

          throw new Error('Sin sesión válida');
        } catch {
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            isLoading: false,
            isHydrated: true,
          });
          return false;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'packlens-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.restoreSession();
      },
    },
  ),
);

setTokenRefreshHandler(({ accessToken, refreshToken }) => {
  useAuthStore.setState({ accessToken, refreshToken });
});

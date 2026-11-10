import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as api from '../api';
import type { ApiUser } from '../api/mappers';
import { setTokenRefreshHandler, ApiError, setActiveOrganizationId } from '../api/client';
import type { TenantConfig } from '../lib/tenant/types';
import type { Role } from '../types';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials?: string;
}

export interface AuthOrganization {
  id: string;
  slug: string;
  name: string;
  template_key: string;
  status: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  organization: AuthOrganization | null;
  tenantConfig: TenantConfig | null;
  memberships: Array<{
    organization_id: string;
    role: string;
    organization: AuthOrganization | null;
  }>;
  availableOrganizations: AuthOrganization[];
  isPlatformAdmin: boolean;
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
  /** Actualiza campos del usuario en sesión (p. ej. tras cambiarse el rol a sí mismo). */
  patchSessionUser: (partial: Partial<AuthUser>) => void;
  setOrganizationId: (id: string) => Promise<void>;
  applyMe: (me: ApiUser) => void;
}

function applyMeToState(me: ApiUser) {
  const organization = me.organization ?? null;
  if (organization?.id) setActiveOrganizationId(organization.id);
  return {
    user: {
      id: me.id,
      name: me.name,
      email: me.email,
      role: me.role as Role,
      initials: me.initials ?? undefined,
    } as AuthUser,
    organization,
    tenantConfig: me.tenant_config ?? null,
    memberships: (me.memberships || []).map((m) => ({
      organization_id: m.organization_id,
      role: m.role,
      organization: m.organization,
    })),
    availableOrganizations: me.available_organizations || [],
    isPlatformAdmin: Boolean(me.is_platform_admin),
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      organization: null,
      tenantConfig: null,
      memberships: [],
      availableOrganizations: [],
      isPlatformAdmin: false,
      isHydrated: false,
      isLoading: false,
      error: null,

      applyMe: (me) => {
        set(applyMeToState(me));
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const tokens = await api.login(email, password);
          set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          });
          const me = await api.getMe();
          set({ ...applyMeToState(me), isLoading: false });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error de autenticación';
          set({
            isLoading: false,
            error: msg,
            accessToken: null,
            refreshToken: null,
            user: null,
            organization: null,
            tenantConfig: null,
            memberships: [],
            availableOrganizations: [],
            isPlatformAdmin: false,
          });
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
          set({ ...applyMeToState(me), isLoading: false });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error al registrar';
          set({
            isLoading: false,
            error: msg,
            accessToken: null,
            refreshToken: null,
            user: null,
            organization: null,
            tenantConfig: null,
            memberships: [],
            availableOrganizations: [],
            isPlatformAdmin: false,
          });
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
          set({ ...applyMeToState(me), isLoading: false });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error al aceptar invitación';
          set({
            isLoading: false,
            error: msg,
            accessToken: null,
            refreshToken: null,
            user: null,
            organization: null,
            tenantConfig: null,
            memberships: [],
            availableOrganizations: [],
            isPlatformAdmin: false,
          });
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
        setActiveOrganizationId(null);
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          organization: null,
          tenantConfig: null,
          memberships: [],
          availableOrganizations: [],
          isPlatformAdmin: false,
        });
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
                ...applyMeToState(me),
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
              ...applyMeToState(me),
              isLoading: false,
              isHydrated: true,
            });
            return true;
          }

          throw new Error('Sin sesión válida');
        } catch {
          setActiveOrganizationId(null);
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            organization: null,
            tenantConfig: null,
            memberships: [],
            availableOrganizations: [],
            isPlatformAdmin: false,
            isLoading: false,
            isHydrated: true,
          });
          return false;
        }
      },

      clearError: () => set({ error: null }),

      patchSessionUser: (partial) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...partial } });
      },

      setOrganizationId: async (id: string) => {
        setActiveOrganizationId(id);
        const me = await api.getMe();
        set(applyMeToState(me));
        // Forzar recarga de proyectos/datos del tenant activo
        const { useAppStore } = await import('./useAppStore');
        useAppStore.setState({ isBootstrapped: false });
        await useAppStore.getState().bootstrap();
      },
    }),
    {
      name: 'packlens-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
        organization: s.organization,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.organization?.id) setActiveOrganizationId(state.organization.id);
        state?.restoreSession();
      },
    },
  ),
);

setTokenRefreshHandler(({ accessToken, refreshToken }) => {
  useAuthStore.setState({ accessToken, refreshToken });
});

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';
import { idbStorage } from './idbStorage';

export type LocalCampaignMedia = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** data URL para boceto local (imagen / vídeo / audio) */
  dataUrl: string;
};

export type LocalCampaign = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  notes: string;
  color: string;
  media: LocalCampaignMedia[];
  createdAt: string;
};

type LocalCampaignsState = {
  campaigns: LocalCampaign[];
  hydrated: boolean;
  scopeKey: string | null;
  setHydrated: (v: boolean) => void;
  addCampaign: (input: Omit<LocalCampaign, 'id' | 'createdAt'>) => LocalCampaign;
  updateCampaign: (id: string, patch: Partial<Omit<LocalCampaign, 'id' | 'createdAt'>>) => void;
  removeCampaign: (id: string) => void;
};

const COLORS = [
  '#3b82f6',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

const LEGACY_STORAGE_NAME = 'packlens-local-campaigns';
const UNSCOPED_STORAGE_NAME = 'packlens-local-campaigns:none';

/** Clave IndexedDB aislada por usuario + organización. */
export function localCampaignsStorageKey(userId: string, organizationId: string): string {
  return `${LEGACY_STORAGE_NAME}:${userId}:${organizationId}`;
}

let persistPaused = false;
let activeScope: string | null = null;
let legacyCleanupStarted = false;

/** Storage que no escribe mientras se cambia de scope (evita pisar IDB con []). */
const gatedIdbStorage: StateStorage = {
  getItem: async (name) => {
    if (name === UNSCOPED_STORAGE_NAME) return null;
    return idbStorage.getItem(name);
  },
  setItem: async (name, value) => {
    if (persistPaused || name === UNSCOPED_STORAGE_NAME) return;
    await idbStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    if (name === UNSCOPED_STORAGE_NAME) return;
    await idbStorage.removeItem(name);
  },
};

export function nextCampaignColor(existing: LocalCampaign[]): string {
  return COLORS[existing.length % COLORS.length];
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export const useLocalCampaignsStore = create<LocalCampaignsState>()(
  persist(
    (set, get) => ({
      campaigns: [],
      hydrated: false,
      scopeKey: null,
      setHydrated: (v) => set({ hydrated: v }),
      addCampaign: (input) => {
        const campaign: LocalCampaign = {
          ...input,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set({ campaigns: [...get().campaigns, campaign] });
        return campaign;
      },
      updateCampaign: (id, patch) => {
        set({
          campaigns: get().campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        });
      },
      removeCampaign: (id) => {
        set({ campaigns: get().campaigns.filter((c) => c.id !== id) });
      },
    }),
    {
      name: UNSCOPED_STORAGE_NAME,
      storage: createJSONStorage(() => gatedIdbStorage),
      partialize: (s) => ({ campaigns: s.campaigns }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

function cleanupLegacySharedKey() {
  if (legacyCleanupStarted || typeof window === 'undefined') return;
  legacyCleanupStarted = true;
  void del(LEGACY_STORAGE_NAME).catch(() => {
    /* ignore */
  });
}

/**
 * Aísla memoria + IndexedDB al par usuario/org.
 * Al cambiar de sesión o tenant, limpia el estado en memoria y rehidrata solo esa clave.
 */
export async function bindLocalCampaignsScope(
  userId: string | null | undefined,
  organizationId: string | null | undefined,
): Promise<void> {
  const next =
    userId && organizationId ? localCampaignsStorageKey(userId, organizationId) : null;
  if (next === activeScope) {
    if (next && !useLocalCampaignsStore.getState().hydrated) {
      await useLocalCampaignsStore.persist.rehydrate();
    }
    return;
  }

  persistPaused = true;
  try {
    activeScope = next;
    cleanupLegacySharedKey();
    useLocalCampaignsStore.persist.setOptions({
      name: next ?? UNSCOPED_STORAGE_NAME,
    });
    useLocalCampaignsStore.setState({
      campaigns: [],
      hydrated: false,
      scopeKey: next,
    });

    if (!next) {
      useLocalCampaignsStore.setState({ hydrated: true });
      return;
    }

    await useLocalCampaignsStore.persist.rehydrate();
    if (!useLocalCampaignsStore.getState().hydrated) {
      useLocalCampaignsStore.setState({ hydrated: true });
    }
  } finally {
    persistPaused = false;
  }
}

/** Logout / sin sesión: vacía memoria y deja de apuntar a ninguna clave. */
export async function clearLocalCampaignsScope(): Promise<void> {
  await bindLocalCampaignsScope(null, null);
}

/** Solo tests: lee el scope activo en memoria. */
export function getActiveLocalCampaignsScope(): string | null {
  return activeScope;
}

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
      name: 'packlens-local-campaigns',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ campaigns: s.campaigns }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

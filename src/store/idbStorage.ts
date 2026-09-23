/**
 * Adaptador de almacenamiento para Zustand persist que usa IndexedDB
 * a través de idb-keyval.  Soporta valores > 5 MB (límite de localStorage).
 */
import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    const value = await get<string>(name);
    return value ?? null;
  },
  setItem: async (name, value) => {
    await set(name, value);
  },
  removeItem: async (name) => {
    await del(name);
  },
};

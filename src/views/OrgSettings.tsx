'use client';

import { useCallback, useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import * as api from '../api';
import { toast } from '../components/ui/Toast';
import { useAuthStore } from '../store/useAuthStore';
import { getErrorMessage } from '../utils/errors';
import { isPlatformAdminRole } from '../types';

type NavToggle = { id: string; label: string; path: string; enabled: boolean };

export default function OrgSettings() {
  const user = useAuthStore((s) => s.user);
  const applyMe = useAuthStore((s) => s.applyMe);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<NavToggle[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNavSettings();
      setItems(data.items);
    } catch (e) {
      toast.error(getErrorMessage(e, 'No se pudo cargar la configuración'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPlatformAdminRole(user?.role)) return;
    void reload();
  }, [reload, user?.role]);

  if (!isPlatformAdminRole(user?.role)) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">
          Solo Admin puede configurar qué pestañas ven los miembros de la organización.
        </p>
      </div>
    );
  }

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const navVisibility = Object.fromEntries(items.map((i) => [i.id, i.enabled]));
      await api.updateNavSettings(navVisibility);
      const me = await api.getMe();
      applyMe(me);
      toast.success('Configuración guardada');
    } catch (e) {
      toast.error(getErrorMessage(e, 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <div className="flex items-start gap-3 mb-6">
        <div className="mt-0.5 p-2 rounded-lg bg-slate-100 text-slate-600">
          <Settings2 size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-primary">Configuración</h1>
          <p className="mt-1 text-sm text-slate-500">
            Elige qué pestañas ven el resto de miembros. Tú, como Admin, sigues viendo todas.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3 cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">{item.label}</p>
                <p className="text-xs text-slate-400 truncate">{item.path}</p>
              </div>
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => toggle(item.id)}
                className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
              />
            </label>
          ))}

          <div className="pt-4">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

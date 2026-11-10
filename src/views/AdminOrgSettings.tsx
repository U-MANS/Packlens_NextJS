'use client';

import { useCallback, useEffect, useState } from 'react';
import { getOrgSettings, updateOrgSettings } from '../api';
import { useAuthStore } from '../store/useAuthStore';
import type { TenantConfig, TenantNavItem, TenantPhaseDef } from '../lib/tenant/types';

export default function AdminOrgSettings() {
  const applyMe = useAuthStore((s) => s.applyMe);
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [templateKey, setTemplateKey] = useState('packaging-helios');
  const [templates, setTemplates] = useState<Array<{ key: string; name: string }>>([]);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [phaseLabels, setPhaseLabels] = useState<Record<string, string>>({});
  const [nav, setNav] = useState<TenantNavItem[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrgSettings();
      setOrgName(data.organization.name);
      setTemplateKey(data.template_key);
      setTemplates(data.templates);
      setConfig(data.config);
      const labels: Record<string, string> = {};
      data.config.phases.forEach((p) => {
        labels[p.label] = p.displayName;
      });
      setPhaseLabels(labels);
      setNav(data.config.nav.map((n) => ({ ...n })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando configuración');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (user?.role !== 'Admin') {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">
          Solo Admin de plataforma puede configurar el tenant. Los Managers gestionan el
          día a día del cliente, no esta pantalla.
        </p>
      </div>
    );
  }

  const save = async (extra?: { apply_template?: boolean; template_key?: string }) => {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const settings = {
        name: orgName,
        phaseDisplayNames: phaseLabels,
        nav,
      };
      const result = await updateOrgSettings({
        name: orgName,
        template_key: extra?.template_key ?? templateKey,
        settings: extra?.apply_template ? undefined : settings,
        apply_template: extra?.apply_template,
      });
      setConfig(result.config);
      setOrgName(result.organization.name);
      setTemplateKey(result.organization.template_key);
      setNav(result.config.nav.map((n) => ({ ...n })));
      const labels: Record<string, string> = {};
      result.config.phases.forEach((p: TenantPhaseDef) => {
        labels[p.label] = p.displayName;
      });
      setPhaseLabels(labels);
      setOk('Configuración guardada');
      // Refrescar sesión para Layout / permisos
      const me = await import('../api').then((m) => m.getMe());
      applyMe(me);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Cargando configuración</div>;
  }

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Configuración del tenant</h1>
        <p className="text-sm text-slate-500 mt-1">
          Personaliza fases, menú y plantilla sin cambiar el comportamiento de Helios por defecto.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-3 py-2">
          {ok}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">Organización</h2>
        <label className="block text-sm">
          <span className="text-slate-500">Nombre</span>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Plantilla base</span>
          <select
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name} ({t.key})
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="px-4 py-2 rounded-md bg-accent text-white text-sm font-medium disabled:opacity-50"
          >
            Guardar cambios
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save({ apply_template: true, template_key: templateKey })}
            className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Aplicar plantilla (reset overrides)
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">
          Etiquetas de fases
        </h2>
        <p className="text-xs text-slate-500">
          El valor interno (columna phase) no cambia; solo el nombre visible.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {config?.phases.map((p) => (
            <label key={p.id} className="block text-sm">
              <span className="text-slate-500 text-xs">{p.label}</span>
              <input
                value={phaseLabels[p.label] ?? p.displayName}
                onChange={(e) =>
                  setPhaseLabels((prev) => ({ ...prev, [p.label]: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">Menú</h2>
        <ul className="space-y-2">
          {nav.map((item, idx) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(e) => {
                  const next = [...nav];
                  next[idx] = { ...item, enabled: e.target.checked };
                  setNav(next);
                }}
              />
              <div className="flex-1 min-w-0">
                <input
                  value={item.label}
                  onChange={(e) => {
                    const next = [...nav];
                    next[idx] = { ...item, label: e.target.value };
                    setNav(next);
                  }}
                  className="w-full bg-transparent text-sm font-medium text-primary outline-none"
                />
                <p className="text-xs text-slate-400">
                  {item.path}
                  {item.platformOnly
                    ? ' · solo Admin plataforma'
                    : item.adminOnly
                      ? ' · Admin / Manager'
                      : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">Roles</h2>
        <div className="flex flex-wrap gap-2">
          {config?.roles.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {r.label}
            </span>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Matriz de aprobación (quién aprueba qué): definida por la plantilla. Los overrides
          avanzados de permisos se pueden ampliar en settings JSON.
        </p>
        {config && (
          <pre className="text-xs bg-slate-50 border border-border rounded-md p-3 overflow-auto max-h-48">
            {JSON.stringify(config.permissions.approvePhases, null, 2)}
          </pre>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">Flujos</h2>
        <ul className="text-sm text-slate-600 space-y-1">
          {config?.flows.map((f) => (
            <li key={f.id}>
              <span className="font-medium text-primary">{f.name}</span>
              <span className="text-slate-400"> — {f.phaseOrder.length} fases</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

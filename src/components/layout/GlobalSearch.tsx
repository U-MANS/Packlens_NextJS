'use client';

import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  startTransition,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText, FolderKanban, Loader2, Search } from 'lucide-react';
import * as api from '../../api';
import { mapProject } from '../../api/mappers';
import { useAppStore } from '../../store/useAppStore';
import { buildLibraryTree, filterLibraryTree } from '../../utils/library';
import { normalizeSearchQuery, projectMatchesSearch } from '../../utils/projectSearch';
import type { Project } from '../../types';

type SearchHit =
  | {
      kind: 'project';
      id: string;
      title: string;
      subtitle: string;
      href: string;
    }
  | {
      kind: 'library';
      id: string;
      title: string;
      subtitle: string;
      href: string;
    }
  | {
      kind: 'document';
      id: string;
      title: string;
      subtitle: string;
      href: string;
    };

const MIN_QUERY = 2;
const MAX_RESULTS = 8;

function projectToHit(p: Project): SearchHit {
  const bits = [p.sku, p.phase, p.lifecycleStatus].filter(Boolean);
  return {
    kind: 'project',
    id: p.id,
    title: p.name,
    subtitle: bits.join(' · '),
    href: `/projects/${p.id}`,
  };
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const projects = useAppStore((s) => s.projects);
  const documents = useAppStore((s) => s.documents);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remoteProjects, setRemoteProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const q = normalizeSearchQuery(deferredQuery);

  const localHits = useMemo(() => {
    if (q.length < MIN_QUERY) return [] as SearchHit[];

    const projectHits = projects.filter((p) => projectMatchesSearch(p, q)).map(projectToHit);

    const libraryHits = filterLibraryTree(buildLibraryTree(projects), q)
      .flatMap((line) => line.formats.flatMap((fmt) => fmt.products))
      .slice(0, 4)
      .map((product) => ({
        kind: 'library' as const,
        id: product.skuBase,
        title: product.name,
        subtitle: `Biblioteca · ${product.skuBase}`,
        href: `/library/${encodeURIComponent(product.skuBase)}`,
      }));

    const documentHits = documents
      .filter((d) => {
        const title = normalizeSearchQuery(d.title);
        const type = normalizeSearchQuery(d.type);
        return title.includes(q) || type.includes(q);
      })
      .slice(0, 4)
      .map((d) => ({
        kind: 'document' as const,
        id: d.id,
        title: d.title,
        subtitle: `Documento · ${d.type}`,
        href: `/projects/${d.projectId}`,
      }));

    return [...projectHits, ...libraryHits, ...documentHits];
  }, [projects, documents, q]);

  const remoteHits = useMemo(
    () =>
      remoteProjects
        .filter((p) => projectMatchesSearch(p, q))
        .map(projectToHit),
    [remoteProjects, q],
  );

  const hits = useMemo(() => {
    const seen = new Set<string>();
    const merged: SearchHit[] = [];
    for (const hit of [...localHits, ...remoteHits]) {
      const key = `${hit.kind}:${hit.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(hit);
      if (merged.length >= MAX_RESULTS) break;
    }
    return merged;
  }, [localHits, remoteHits]);

  const runRemoteSearch = useEffectEvent(async (term: string) => {
    const trimmed = term.trim();
    if (normalizeSearchQuery(trimmed).length < MIN_QUERY) {
      setRemoteProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await api.listProjects({ archived: 'false', search: trimmed });
      setRemoteProjects(rows.map(mapProject));
    } catch {
      // Mantener resultados locales si la API falla
      setRemoteProjects([]);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runRemoteSearch(deferredQuery);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [deferredQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [hits]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const showPanel = open && normalizeSearchQuery(query).length >= MIN_QUERY;

  const goTo = (hit: SearchHit) => {
    setOpen(false);
    setQuery('');
    startTransition(() => {
      navigate(hit.href);
    });
  };

  const goToAllProjects = () => {
    const term = query.trim();
    setOpen(false);
    setQuery('');
    startTransition(() => {
      navigate(term ? `/projects?q=${encodeURIComponent(term)}` : '/projects');
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showPanel && hits[activeIndex]) goTo(hits[activeIndex]);
      else if (normalizeSearchQuery(query).length >= MIN_QUERY) goToAllProjects();
      return;
    }
    if (!showPanel) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
  };

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0 max-w-xl">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Buscar proyectos y documentos"
        aria-activedescendant={
          showPanel && hits[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined
        }
        placeholder="Buscar proyectos..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full pl-10 pr-3 py-2 bg-slate-100 border-transparent rounded-md text-sm text-primary placeholder:text-slate-400 focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
      />

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-lg border border-border bg-surface shadow-xl overflow-hidden"
        >
          {loading && hits.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" />
              Buscando…
            </div>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              Sin resultados aquí. Pulsa Intro para buscar en Proyectos «{query.trim()}»
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {hits.map((hit, index) => {
                const Icon =
                  hit.kind === 'library'
                    ? BookOpen
                    : hit.kind === 'document'
                      ? FileText
                      : FolderKanban;
                const active = index === activeIndex;
                return (
                  <li key={`${hit.kind}:${hit.id}`} role="none">
                    <button
                      type="button"
                      id={`${listId}-opt-${index}`}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goTo(hit)}
                      className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                        active ? 'bg-accent/10' : 'hover:bg-slate-50'
                      }`}
                    >
                      <Icon
                        size={16}
                        className={`mt-0.5 shrink-0 ${active ? 'text-accent' : 'text-slate-400'}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-primary truncate">
                          {hit.title}
                        </span>
                        <span className="block text-xs text-slate-500 truncate">
                          {hit.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-border px-3 py-2 bg-slate-50/80">
            <button
              type="button"
              onClick={goToAllProjects}
              className="w-full text-left text-xs font-medium text-accent hover:text-accent/80 px-1 py-1"
            >
              Buscar en Proyectos
              {query.trim() ? ` · «${query.trim()}»` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

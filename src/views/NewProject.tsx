import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  CornerDownRight,
  FileText,
  FolderKanban,
  GitBranchPlus,
  Hash,
  Info,
  Loader2,
  Lock,
  Paperclip,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { useAppStore } from '../store/useAppStore';
import { createProjectVersion, listUsers } from '../api';
import { ensureUniqueSku, isSkuTaken, slugSkuFromName } from '../utils/sku';
import type { ApiUser } from '../api/mappers';
import { toast } from '../components/ui/Toast';
import { getErrorMessage } from '../utils/errors';
import { formatDate } from '../utils/dates';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DateInput } from '../components/ui/DateInput';
import {
  availableLanguages,
  availableMarkets,
  productLines,
} from '../data/mockSeed';
import type { FlowType, Project, Role } from '../types';
import { groupProjectsIntoFamilies } from '../utils/library';

function formatTeamOption(user: ApiUser): string {
  return `${user.name} (${user.role})`;
}

function stripRoleSuffix(label: string): string {
  return label.replace(/\s*\([^)]+\)\s*$/, '').trim();
}

function resolveUserId(label: string, users: ApiUser[]): string | undefined {
  if (!label) return undefined;
  const exact = users.find((u) => formatTeamOption(u) === label);
  if (exact) return exact.id;
  const name = stripRoleSuffix(label);
  return users.find((u) => u.name === name)?.id;
}

function collectAssigneeUserIds(
  owners: string[],
  designLeads: string[],
  regulatoryContacts: string[],
  users: ApiUser[],
): string[] {
  const ids = [
    ...owners.map((o) => resolveUserId(o, users)),
    ...designLeads.map((o) => resolveUserId(o, users)),
    ...regulatoryContacts.map((o) => resolveUserId(o, users)),
  ].filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

const formatOptions = [
  'Tarro vidrio 340g',
  'Tarro vidrio 640g',
  'Tarro vidrio 250g',
  'Tarro Hex 300g',
  'Bote 350g',
  'Pack surtidos 8x25g',
  'Lata 825g',
];

interface FormState {
  name: string;
  sku: string;
  productLine: string;
  format: string;
  markets: string[];
  labelLanguages: string[];
  labelLanguagesFront: string[];
  labelLanguagesBack: string[];
  launchDate: string;
  artDeadline: string;
  owners: string[];
  designLeads: string[];
  regulatoryContacts: string[];
  description: string;
  briefingNotes: string;
  briefingFiles: import('../types').BriefingFile[];
  briefingRefs: { id: string; name: string; sku: string }[];
  lifecycleStatus: import('../types').LifecycleStatus;
  // New-version fields
  sourceProjectId?: string;
  sapCode?: string;
  substitutionType: 'Permanente' | 'Temporal';
  temporalEndDate: string;
  // Workflow type
  flowType: FlowType;
}

const initialState: FormState = {
  name: '',
  sku: '',
  productLine: '',
  format: '',
  markets: [],
  labelLanguages: [],
  labelLanguagesFront: [],
  labelLanguagesBack: [],
  launchDate: '',
  artDeadline: '',
  owners: [],
  designLeads: [],
  regulatoryContacts: [],
  description: '',
  briefingNotes: '',
  briefingFiles: [],
  briefingRefs: [],
  lifecycleStatus: 'Borrador',
  substitutionType: 'Permanente',
  temporalEndDate: '',
  flowType: 'Nacional',
};

type CreationMode = 'new' | 'version';

function computeVersionedSku(src: Project, allProjects: Project[]): string {
  const base = src.sku.replace(/-\d{3}$/, '');
  const siblings = allProjects.filter(
    (p) => p.sku === base || new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{3}$`).test(p.sku),
  );
  const maxVersion = siblings.reduce((m, p) => Math.max(m, p.version ?? 1), 1);
  return `${base}-${String(maxVersion + 1).padStart(3, '0')}`;
}

function buildFormFromSource(src: Project, allProjects: Project[]): FormState {
  return {
    ...initialState,
    name: src.name,
    sku: computeVersionedSku(src, allProjects),
    productLine: src.productLine ?? '',
    format: src.format ?? '',
    markets: src.markets ?? (src.market ? [src.language] : []),
    labelLanguagesFront: src.labelLanguagesFront ?? [],
    labelLanguagesBack: src.labelLanguagesBack ?? [],
    labelLanguages: src.labelLanguages ?? [],
    owners: src.owner ? [src.owner] : [],
    designLeads: src.designLead ? [src.designLead] : [],
    regulatoryContacts: src.regulatoryContact ? [src.regulatoryContact] : [],
    description: src.description ?? '',
    sourceProjectId: src.id,
    sapCode: src.sapCode ?? '',
    lifecycleStatus: 'Borrador',
    substitutionType: 'Permanente',
    temporalEndDate: '',
    flowType: src.flowType ?? 'Nacional',
  };
}

const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </span>
    {children}
    {hint && <span className="block text-xs text-slate-400 mt-1.5">{hint}</span>}
  </label>
);

const Chip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
      active
        ? 'bg-accent text-white border-accent'
        : 'bg-white text-slate-700 border-slate-200 hover:border-accent/40 hover:bg-accent/5'
    }`}
  >
    {active && <CheckCircle2 size={14} />}
    {children}
  </button>
);

const inputClass =
  'w-full px-3 py-2 bg-white border border-border rounded-md text-sm text-primary placeholder:text-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all';

/** Dropdown con checkboxes para selección múltiple */
function computeDropdownStyle(
  buttonEl: HTMLButtonElement,
  panelEl: HTMLDivElement,
): React.CSSProperties {
  const rect = buttonEl.getBoundingClientRect();
  const gap = 4;

  panelEl.style.position = 'fixed';
  panelEl.style.left = `${rect.left}px`;
  panelEl.style.width = `${rect.width}px`;
  panelEl.style.top = '-9999px';
  panelEl.style.visibility = 'hidden';

  const height = panelEl.offsetHeight;
  let top = rect.bottom + gap;
  if (top + height > window.innerHeight - gap) {
    top = Math.max(gap, rect.top - height - gap);
  }

  return {
    position: 'fixed',
    top,
    left: rect.left,
    width: rect.width,
    zIndex: 9999,
    visibility: 'visible',
  };
}

const MultiSelectDropdown: React.FC<{
  options: string[];
  selected: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}> = ({ options, selected, placeholder, onChange }) => {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !panelRef.current) return;
    setPanelStyle(computeDropdownStyle(buttonRef.current, panelRef.current));
  }, [open, options.length]);

  useEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt],
    );
  };

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected[0]} +${selected.length - 1} más`;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 bg-white border rounded-md text-sm transition-all ${
          open
            ? 'border-accent ring-2 ring-accent/20 text-primary'
            : 'border-border text-primary hover:border-slate-400'
        }`}
      >
        <span className={selected.length === 0 ? 'text-slate-400' : ''}>{label}</span>
        <ChevronDown
          size={15}
          className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={
              panelStyle ?? {
                position: 'fixed',
                top: -9999,
                left: 0,
                width: buttonRef.current?.offsetWidth ?? 0,
                visibility: 'hidden',
              }
            }
            className="bg-white border border-border rounded-lg shadow-lg py-1 max-h-52 overflow-y-auto"
          >
            {options.map((opt) => {
              const active = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      active ? 'bg-accent border-accent' : 'border-slate-300'
                    }`}
                  >
                    {active && <Check size={11} className="text-white" />}
                  </span>
                  <span className={active ? 'font-medium text-primary' : 'text-slate-700'}>{opt}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
};

const NewProject = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addProject, projects } = useAppStore();
  const [teamUsers, setTeamUsers] = useState<ApiUser[]>([]);
  const [rawBriefingFiles, setRawBriefingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  const fromProjectId = searchParams.get('from') ?? undefined;
  const initialSource = fromProjectId ? projects.find((p) => p.id === fromProjectId) : undefined;

  const [creationMode, setCreationMode] = useState<CreationMode>(
    initialSource ? 'version' : 'new',
  );
  const [form, setForm] = useState<FormState>(() =>
    initialSource ? buildFormFromSource(initialSource, projects) : initialState,
  );
  const [skuTouched, setSkuTouched] = useState(!!initialSource);
  const [versionSearch, setVersionSearch] = useState('');

  const sourceProject = useMemo(() => {
    const id = form.sourceProjectId ?? fromProjectId;
    return id ? projects.find((p) => p.id === id) : undefined;
  }, [form.sourceProjectId, fromProjectId, projects]);

  const productFamilies = useMemo(
    () => groupProjectsIntoFamilies(projects.filter((p) => !p.archived)),
    [projects],
  );

  const filteredFamilies = useMemo(() => {
    const q = versionSearch.trim().toLowerCase();
    if (!q) return productFamilies;
    return productFamilies.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.skuBase.toLowerCase().includes(q) ||
        f.productLine.toLowerCase().includes(q) ||
        f.format.toLowerCase().includes(q) ||
        f.latestVersion.sapCode?.toLowerCase().includes(q),
    );
  }, [productFamilies, versionSearch]);

  const selectSourceProduct = (project: Project) => {
    setForm(buildFormFromSource(project, projects));
    setSkuTouched(true);
    setCreationMode('version');
    navigate(`/projects/new?from=${project.id}`, { replace: true });
  };

  const switchCreationMode = (mode: CreationMode) => {
    setCreationMode(mode);
    setVersionSearch('');
    if (mode === 'new') {
      setForm(initialState);
      setSkuTouched(false);
      setRawBriefingFiles([]);
      navigate('/projects/new', { replace: true });
      return;
    }
    if (form.sourceProjectId) {
      const src = projects.find((p) => p.id === form.sourceProjectId);
      if (src) {
        setForm(buildFormFromSource(src, projects));
        setSkuTouched(true);
        navigate(`/projects/new?from=${src.id}`, { replace: true });
      }
    }
  };

  useEffect(() => {
    if (!fromProjectId) return;
    const src = projects.find((p) => p.id === fromProjectId);
    if (!src) return;
    setCreationMode('version');
    setForm((prev) =>
      prev.sourceProjectId === fromProjectId ? prev : buildFormFromSource(src, projects),
    );
    setSkuTouched(true);
  }, [fromProjectId, projects]);

  useEffect(() => {
    listUsers({ status: 'Activo' })
      .then(setTeamUsers)
      .catch((e) => toast.error(getErrorMessage(e, 'Error cargando el equipo')));
  }, []);

  const teamOptions = useMemo(() => {
    const active = teamUsers.filter((u) => u.status === 'Activo');
    const forRoles = (...roles: Role[]) =>
      active
        .filter((u) => roles.includes(u.role as Role))
        .map(formatTeamOption)
        .sort((a, b) => a.localeCompare(b, 'es'));
    return {
      marketing: forRoles('Marketing', 'Admin'),
      design: forRoles('Diseño', 'Admin'),
      regulatory: forRoles('I+D', 'Admin'),
    };
  }, [teamUsers]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [refSearch, setRefSearch] = useState('');

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const activeSkus = useMemo(
    () => projects.filter((p) => !p.archived).map((p) => p.sku),
    [projects],
  );

  const onNameChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      sku: skuTouched
        ? prev.sku
        : ensureUniqueSku(slugSkuFromName(value), activeSkus),
    }));
  };

  const toggleMarket = (code: string) => {
    setForm((prev) => ({
      ...prev,
      markets: prev.markets.includes(code)
        ? prev.markets.filter((m) => m !== code)
        : [...prev.markets, code],
    }));
  };

  const toggleLanguageFront = (lang: string) => {
    setForm((prev) => ({
      ...prev,
      labelLanguagesFront: prev.labelLanguagesFront.includes(lang)
        ? prev.labelLanguagesFront.filter((l) => l !== lang)
        : [...prev.labelLanguagesFront, lang],
    }));
  };

  const toggleLanguageBack = (lang: string) => {
    setForm((prev) => ({
      ...prev,
      labelLanguagesBack: prev.labelLanguagesBack.includes(lang)
        ? prev.labelLanguagesBack.filter((l) => l !== lang)
        : [...prev.labelLanguagesBack, lang],
    }));
  };

  const addBriefingFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    setRawBriefingFiles((prev) => [...prev, ...arr]);
    arr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setForm((prev) => ({
          ...prev,
          briefingFiles: [
            ...prev.briefingFiles,
            {
              name: file.name,
              sizeKb: Math.max(1, Math.round(file.size / 1024)),
              dataUrl: reader.result as string,
              mimeType: file.type || 'application/octet-stream',
            },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeBriefingFile = (idx: number) => {
    setRawBriefingFiles((prev) => prev.filter((_, i) => i !== idx));
    setForm((prev) => ({
      ...prev,
      briefingFiles: prev.briefingFiles.filter((_, i) => i !== idx),
    }));
  };

  const appendToNotes = (label: string) => {
    setForm((prev) => {
      const current = prev.briefingNotes.trimEnd();
      const separator = current.length > 0 ? '\n' : '';
      return { ...prev, briefingNotes: `${current}${separator}· ${label}` };
    });
    notesRef.current?.focus();
  };

  const addBriefingRef = (project: { id: string; name: string; sku: string }) => {
    if (form.briefingRefs.some((r) => r.id === project.id)) return;
    setForm((prev) => ({ ...prev, briefingRefs: [...prev.briefingRefs, project] }));
  };

  const removeBriefingRef = (id: string) => {
    setForm((prev) => ({
      ...prev,
      briefingRefs: prev.briefingRefs.filter((r) => r.id !== id),
    }));
  };

  const isAvFlow = form.flowType === 'Campaña audiovisual';

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = isAvFlow ? 'Nombre de campaña obligatorio' : 'Nombre obligatorio';
    if (!form.sku.trim()) e.sku = isAvFlow ? 'Código de campaña obligatorio' : 'Código de artículo obligatorio';
    else if (creationMode === 'new' && isSkuTaken(form.sku, projects)) {
      e.sku = `El código «${form.sku.trim()}» ya está en uso. Edítalo manualmente o cambia el nombre.`;
    }
    if (form.markets.length === 0) e.markets = 'Selecciona al menos un mercado';
    if (!isAvFlow) {
      if (form.labelLanguagesFront.length === 0) e.labelLanguagesFront = 'Selecciona al menos un idioma frontal';
      if (form.labelLanguagesBack.length === 0) e.labelLanguagesBack = 'Selecciona al menos un idioma trasero';
    } else if (form.labelLanguages.length === 0) {
      e.labelLanguages = 'Selecciona al menos un idioma';
    }
    if (!form.owners.length) e.owners = 'Asigna al menos un responsable';
    if (!form.launchDate) e.launchDate = 'Fecha de lanzamiento requerida';
    if (!form.artDeadline) e.artDeadline = 'Fecha límite de arte requerida';
    if (
      form.launchDate &&
      form.artDeadline &&
      new Date(form.artDeadline) > new Date(form.launchDate)
    ) {
      e.artDeadline = 'La fecha límite de arte debe ser anterior al lanzamiento';
    }
    if (creationMode === 'version' && !form.sourceProjectId) {
      e.sourceProjectId = 'Selecciona el producto del que crear la nueva versión';
    }
    return e;
  }, [form, creationMode, projects, isAvFlow]);

  const toggleLanguage = (lang: string) => {
    setForm((prev) => ({
      ...prev,
      labelLanguages: prev.labelLanguages.includes(lang)
        ? prev.labelLanguages.filter((l) => l !== lang)
        : [...prev.labelLanguages, lang],
    }));
  };

  const isValid = Object.keys(errors).length === 0;

  const handleSubmit = async (asDraft: boolean) => {
    setSubmitAttempted(true);
    if (!asDraft && !isValid) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        flow_type: form.flowType,
        product_line: isAvFlow ? undefined : form.productLine || undefined,
        format: isAvFlow ? undefined : form.format || undefined,
        markets: form.markets,
        label_languages: isAvFlow
          ? form.labelLanguages
          : form.labelLanguages,
        label_languages_front: isAvFlow ? [] : form.labelLanguagesFront,
        label_languages_back: isAvFlow ? [] : form.labelLanguagesBack,
        launch_date: form.launchDate || undefined,
        art_deadline: form.artDeadline || undefined,
        owner_name: form.owners[0] ? stripRoleSuffix(form.owners[0]) : undefined,
        design_lead: form.designLeads[0] ? stripRoleSuffix(form.designLeads[0]) : undefined,
        regulatory_contact: form.regulatoryContacts[0]
          ? stripRoleSuffix(form.regulatoryContacts[0])
          : undefined,
        assignee_user_ids: collectAssigneeUserIds(
          form.owners,
          form.designLeads,
          form.regulatoryContacts,
          teamUsers,
        ),
        description: form.description.trim(),
        briefing_notes: form.briefingNotes || undefined,
        briefing_refs: form.briefingRefs,
        substitution_type: form.sourceProjectId ? form.substitutionType : undefined,
        temporal_end_date:
          form.sourceProjectId && form.substitutionType === 'Temporal'
            ? form.temporalEndDate || undefined
            : undefined,
      };

      let projectId: string;
      if (form.sourceProjectId) {
        const created = await createProjectVersion(
          form.sourceProjectId,
          form.substitutionType,
          form.substitutionType === 'Temporal' ? form.temporalEndDate : undefined,
        );
        projectId = created.id;
      } else {
        projectId = await addProject(payload, rawBriefingFiles);
      }
      navigate(`/projects/${projectId}`);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Error al crear el proyecto'));
    } finally {
      setSubmitting(false);
    }
  };

  const summary = useMemo(
    () => [
      { label: 'Flujo', value: form.flowType },
      { label: 'Nombre', value: form.name || '—' },
      { label: 'Cód. artículo', value: form.sku || '—', mono: true },
      { label: 'Gama', value: form.productLine || '—' },
      { label: 'Formato', value: form.format || '—' },
      {
        label: 'Mercados',
        value: form.markets.length ? form.markets.join(' · ') : '—',
        mono: true,
      },
      {
        label: 'Idiomas frontal',
        value: form.labelLanguagesFront.length ? form.labelLanguagesFront.join(' · ') : '—',
      },
      {
        label: 'Idiomas trasera',
        value: form.labelLanguagesBack.length ? form.labelLanguagesBack.join(' · ') : '—',
      },
      { label: 'Lanzamiento', value: form.launchDate || '—' },
      { label: 'Límite arte', value: form.artDeadline || '—' },
      { label: 'Responsable', value: form.owners.length ? form.owners.join(', ') : '—' },
      { label: 'Resp. diseño', value: form.designLeads.length ? form.designLeads.join(', ') : '—' },
      { label: 'I+D y Calidad', value: form.regulatoryContacts.length ? form.regulatoryContacts.join(', ') : '—' },
    ],
    [form],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header */}
      <div className="bg-surface border-b border-border px-8 pt-6 pb-5 shrink-0">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-3"
        >
          <ArrowLeft size={16} /> Volver a proyectos
        </button>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-primary">
                {sourceProject ? `Nueva versión · ${sourceProject.name}` : 'Nuevo proyecto de packaging'}
              </h1>
              {sourceProject ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <Hash size={12} /> v{(sourceProject.version ?? 1) + 1} · Nueva versión
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                  <Sparkles size={12} /> Paso 1 / 6 · Entrada del proyecto
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {sourceProject
                ? `Creando nueva versión a partir de ${sourceProject.sku}. Los campos están pre-rellenados con los datos del proyecto original.`
                : 'Define el código de artículo, mercados objetivo, equipo responsable y adjunta el briefing creativo para arrancar el flujo de aprobación.'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">
          <div className="space-y-6">

            {/* Creation mode */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>¿Qué quieres crear?</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Puedes arrancar un packaging desde cero o generar una nueva versión de un producto ya registrado.
                </p>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => switchCreationMode('new')}
                    className={`flex flex-col items-start gap-1.5 rounded-lg border-2 px-4 py-3 text-left transition-all ${
                      creationMode === 'new'
                        ? 'border-accent bg-accent/5 shadow-sm'
                        : 'border-border bg-white hover:border-accent/40 hover:bg-accent/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Sparkles size={18} className={creationMode === 'new' ? 'text-accent' : 'text-slate-400'} />
                      <span className={`text-sm font-semibold ${creationMode === 'new' ? 'text-accent' : 'text-primary'}`}>
                        Proyecto nuevo
                      </span>
                      {creationMode === 'new' && (
                        <CheckCircle2 size={16} className="text-accent ml-auto" />
                      )}
                    </div>
                    <span className="text-xs text-slate-500 leading-snug">
                      Nuevo código de artículo y flujo de aprobación desde cero.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchCreationMode('version')}
                    className={`flex flex-col items-start gap-1.5 rounded-lg border-2 px-4 py-3 text-left transition-all ${
                      creationMode === 'version'
                        ? 'border-amber-500 bg-amber-50/60 shadow-sm'
                        : 'border-border bg-white hover:border-amber-300 hover:bg-amber-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <GitBranchPlus size={18} className={creationMode === 'version' ? 'text-amber-600' : 'text-slate-400'} />
                      <span className={`text-sm font-semibold ${creationMode === 'version' ? 'text-amber-800' : 'text-primary'}`}>
                        Nueva versión
                      </span>
                      {creationMode === 'version' && (
                        <CheckCircle2 size={16} className="text-amber-600 ml-auto" />
                      )}
                    </div>
                    <span className="text-xs text-slate-500 leading-snug">
                      Sustituye o actualiza un producto existente manteniendo su historial.
                    </span>
                  </button>
                </div>

                {creationMode === 'version' && (
                  <div className="space-y-3 pt-1 border-t border-border">
                    {sourceProject ? (
                      <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
                            Producto base seleccionado
                          </p>
                          <p className="font-medium text-primary truncate">{sourceProject.name}</p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {sourceProject.sku} · v{sourceProject.version ?? 1}
                            {sourceProject.sapCode ? ` · SAP ${sourceProject.sapCode}` : ''}
                          </p>
                          <p className="text-xs text-amber-700 mt-1">
                            Nueva versión: <span className="font-mono font-semibold">{form.sku}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setForm(initialState);
                            setSkuTouched(false);
                            navigate('/projects/new', { replace: true });
                          }}
                          className="text-xs font-medium text-amber-700 hover:text-amber-900 shrink-0"
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600">
                          Selecciona el producto del que quieres crear una nueva versión.
                        </p>
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={versionSearch}
                            onChange={(e) => setVersionSearch(e.target.value)}
                            placeholder="Buscar por nombre, SKU, gama o SAP…"
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-border rounded-md focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                          />
                        </div>
                        <ul className="max-h-56 overflow-y-auto divide-y divide-border border border-border rounded-lg">
                          {filteredFamilies.map((family) => (
                            <li key={family.skuBase}>
                              <button
                                type="button"
                                onClick={() => selectSourceProduct(family.latestVersion)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-50/60 transition-colors"
                              >
                                <div className="w-9 h-9 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                  <GitBranchPlus size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-primary truncate">{family.name}</p>
                                  <p className="text-xs text-slate-400 font-mono truncate">
                                    {family.skuBase}
                                    {family.productLine ? ` · ${family.productLine}` : ''}
                                    {family.format ? ` · ${family.format}` : ''}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs font-mono text-slate-500">v{family.latestVersion.version ?? 1}</p>
                                  {family.versionCount > 1 && (
                                    <p className="text-[10px] text-slate-400">{family.versionCount} versiones</p>
                                  )}
                                </div>
                              </button>
                            </li>
                          ))}
                          {filteredFamilies.length === 0 && (
                            <li className="px-4 py-8 text-sm text-slate-400 text-center">
                              {productFamilies.length === 0
                                ? 'No hay productos disponibles. Crea primero un proyecto.'
                                : 'No hay productos que coincidan con la búsqueda.'}
                            </li>
                          )}
                        </ul>
                        {submitAttempted && errors.sourceProjectId && (
                          <p className="text-xs text-red-500">{errors.sourceProjectId}</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {(creationMode === 'new' || sourceProject) && (
            <>
            {/* Flow type selector */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Tipo de flujo</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Selecciona el tipo de flujo de aprobación. Exportación y Marca Blanca estarán
                  disponibles en fases posteriores.
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(
                    [
                      {
                        value: 'Nacional',
                        icon: '🏠',
                        description: 'Distribución en mercado nacional.',
                        locked: false,
                      },
                      {
                        value: 'Campaña audiovisual',
                        icon: '🎬',
                        description: 'Producción y aprobación de piezas audiovisuales.',
                        locked: false,
                      },
                      {
                        value: 'Exportación',
                        icon: '🌍',
                        description: 'Distribución en mercados internacionales.',
                        locked: true,
                      },
                      {
                        value: 'Marca Blanca',
                        icon: '🏷️',
                        description: 'Producto bajo marca de distribuidor.',
                        locked: true,
                      },
                    ] as { value: FlowType; icon: string; description: string; locked: boolean }[]
                  ).map(({ value, icon, description, locked }) => {
                    const active = form.flowType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          if (!locked) setForm((p) => ({ ...p, flowType: value }));
                        }}
                        className={`flex flex-col items-start gap-1.5 rounded-lg border-2 px-3 sm:px-4 py-3 text-left transition-all min-w-0 overflow-hidden ${
                          locked
                            ? 'border-border bg-slate-50 opacity-60 cursor-not-allowed'
                            : active
                              ? 'border-accent bg-accent/5 shadow-sm'
                              : 'border-border bg-white hover:border-accent/40 hover:bg-accent/5'
                        }`}
                      >
                        <div className="flex items-start gap-2 w-full min-w-0">
                          <span className="text-lg leading-none shrink-0 mt-0.5">{icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-1.5">
                              <span
                                className={`text-sm font-semibold leading-snug break-words ${
                                  active ? 'text-accent' : locked ? 'text-slate-400' : 'text-primary'
                                }`}
                              >
                                {value}
                              </span>
                              {!locked && active && (
                                <CheckCircle2 size={16} className="text-accent shrink-0 mt-0.5" />
                              )}
                            </div>
                            {locked && (
                              <span className="mt-1 inline-flex items-center gap-1 max-w-full rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                                <Lock size={10} className="shrink-0" />
                                <span className="truncate">Próximamente</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs leading-snug ${locked ? 'text-slate-400' : 'text-slate-500'}`}>
                          {description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Información del producto / campaña */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {isAvFlow ? 'Información de la campaña' : 'Información del producto'}
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  {isAvFlow
                    ? 'Identifica la campaña audiovisual y su código interno.'
                    : 'Identifica el código de artículo y el formato base del nuevo packaging.'}
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label={isAvFlow ? 'Nombre de la campaña' : 'Nombre del producto'} required>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder={
                        isAvFlow
                          ? 'Ej. Spot verano Helios 2026'
                          : 'Ej. Mermelada de Fresa Helios 340g'
                      }
                      className={inputClass}
                    />
                    {submitAttempted && errors.name && (
                      <span className="text-xs text-red-500 mt-1 block">{errors.name}</span>
                    )}
                  </Field>

                  <Field
                    label={isAvFlow ? 'Código de campaña' : 'Código de artículo'}
                    required
                    hint="Auto-sugerido a partir del nombre, editable."
                  >
                    <div className="relative">
                      <Hash
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={form.sku}
                        onChange={(e) => {
                          setSkuTouched(true);
                          update('sku', e.target.value.toUpperCase());
                        }}
                        placeholder={isAvFlow ? 'CAM-SPOT-2026' : 'MER-FRE-340'}
                        className={`${inputClass} pl-9 font-mono tracking-wide`}
                      />
                    </div>
                    {submitAttempted && errors.sku && (
                      <span className="text-xs text-red-500 mt-1 block">{errors.sku}</span>
                    )}
                  </Field>

                  {!isAvFlow && (
                    <>
                      <Field label="Gama">
                        <select
                          value={form.productLine}
                          onChange={(e) => update('productLine', e.target.value)}
                          className={inputClass}
                        >
                          <option value="">Selecciona una gama…</option>
                          {productLines.map((line) => (
                            <option key={line} value={line}>
                              {line}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Formato" hint="Tipo de envase y capacidad.">
                        <select
                          value={form.format}
                          onChange={(e) => update('format', e.target.value)}
                          className={inputClass}
                        >
                          <option value="">Selecciona un formato…</option>
                          {formatOptions.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </Field>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Mercados e idiomas */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {isAvFlow ? 'Mercados e idiomas' : 'Mercados e idiomas de etiqueta'}
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  {isAvFlow
                    ? 'Selecciona los mercados destino y los idiomas de la campaña.'
                    : 'Selecciona todos los mercados destino y los idiomas que tendrá la etiqueta.'}
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Mercados destino <span className="text-red-500">*</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {availableMarkets.map((m) => (
                      <Chip
                        key={m.code}
                        active={form.markets.includes(m.code)}
                        onClick={() => toggleMarket(m.code)}
                      >
                        <span className="font-mono text-xs">{m.code}</span>
                        <span className="text-slate-500">{m.label}</span>
                      </Chip>
                    ))}
                  </div>
                  {submitAttempted && errors.markets && (
                    <span className="text-xs text-red-500 mt-2 block">{errors.markets}</span>
                  )}
                </div>

                {isAvFlow ? (
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Idiomas <span className="text-red-500">*</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {availableLanguages.map((l) => (
                        <Chip
                          key={l}
                          active={form.labelLanguages.includes(l)}
                          onClick={() => toggleLanguage(l)}
                        >
                          {l}
                        </Chip>
                      ))}
                    </div>
                    {submitAttempted && errors.labelLanguages && (
                      <span className="text-xs text-red-500 mt-2 block">{errors.labelLanguages}</span>
                    )}
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        Idiomas de etiqueta — Cara frontal <span className="text-red-500">*</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {availableLanguages.map((l) => (
                          <Chip
                            key={l}
                            active={form.labelLanguagesFront.includes(l)}
                            onClick={() => toggleLanguageFront(l)}
                          >
                            {l}
                          </Chip>
                        ))}
                      </div>
                      {submitAttempted && errors.labelLanguagesFront && (
                        <span className="text-xs text-red-500 mt-2 block">{errors.labelLanguagesFront}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        Idiomas de etiqueta — Cara trasera <span className="text-red-500">*</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {availableLanguages.map((l) => (
                          <Chip
                            key={l}
                            active={form.labelLanguagesBack.includes(l)}
                            onClick={() => toggleLanguageBack(l)}
                          >
                            {l}
                          </Chip>
                        ))}
                      </div>
                      {submitAttempted && errors.labelLanguagesBack && (
                        <span className="text-xs text-red-500 mt-2 block">{errors.labelLanguagesBack}</span>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Fechas y equipo */}
            <Card>
              <CardHeader>
                <CardTitle>Fechas y equipo</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Hitos clave y personas responsables del proyecto.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field
                    label="Fecha límite de arte"
                    required
                    hint="Debe ser anterior al lanzamiento."
                  >
                    <DateInput
                      value={form.artDeadline}
                      onChange={(v) => update('artDeadline', v)}
                      className={inputClass}
                    />
                    {submitAttempted && errors.artDeadline && (
                      <span className="text-xs text-red-500 mt-1 block">{errors.artDeadline}</span>
                    )}
                  </Field>

                  <Field label="Fecha de lanzamiento" required>
                    <DateInput
                      value={form.launchDate}
                      onChange={(v) => update('launchDate', v)}
                      className={inputClass}
                    />
                    {submitAttempted && errors.launchDate && (
                      <span className="text-xs text-red-500 mt-1 block">{errors.launchDate}</span>
                    )}
                  </Field>

                  <Field label="Responsable (Marketing)" required hint="Usuarios de Marketing o Admin.">
                    <MultiSelectDropdown
                      options={teamOptions.marketing}
                      selected={form.owners}
                      placeholder={
                        teamOptions.marketing.length
                          ? 'Selecciona responsable/s…'
                          : 'No hay usuarios de Marketing o Admin — créalos en Usuarios'
                      }
                      onChange={(v) => setForm((p) => ({ ...p, owners: v }))}
                    />
                    {submitAttempted && errors.owners && (
                      <span className="text-xs text-red-500 mt-1 block">{errors.owners}</span>
                    )}
                  </Field>

                  <Field
                    label="Responsable de diseño"
                    hint="Usuarios de Diseño o Admin."
                  >
                    <MultiSelectDropdown
                      options={teamOptions.design}
                      selected={form.designLeads}
                      placeholder={
                        teamOptions.design.length
                          ? 'Sin asignar'
                          : 'No hay usuarios de Diseño o Admin — créalos en Usuarios'
                      }
                      onChange={(v) => setForm((p) => ({ ...p, designLeads: v }))}
                    />
                  </Field>

                  <Field label="Contacto I+D y Calidad" hint="Usuarios de I+D o Admin.">
                    <MultiSelectDropdown
                      options={teamOptions.regulatory}
                      selected={form.regulatoryContacts}
                      placeholder={
                        teamOptions.regulatory.length
                          ? 'Sin asignar'
                          : 'No hay usuarios de I+D o Admin — créalos en Usuarios'
                      }
                      onChange={(v) => setForm((p) => ({ ...p, regulatoryContacts: v }))}
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* Briefing */}
            <Card>
              <CardHeader>
                <CardTitle>Briefing creativo</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Adjunta el briefing y resume los puntos clave para el equipo de diseño.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="Descripción breve">
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                    placeholder="Objetivo del proyecto, contexto comercial, motivos de la actualización…"
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Archivos adjuntos del briefing
                  </span>

                  {/* Drop zone */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-lg py-6 px-4 text-sm text-slate-500 hover:border-accent hover:bg-accent/5 transition-colors"
                  >
                    <Upload size={20} className="text-slate-400" />
                    <span>
                      <span className="text-accent font-medium">Añadir archivos</span> · PDF, AI, PNG
                    </span>
                    <span className="text-xs text-slate-400">Puedes subir varios archivos</span>
                  </button>

                  {/* Add reference link */}
                  <button
                    type="button"
                    onClick={() => { setRefSearch(''); setRefModalOpen(true); }}
                    className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-accent transition-colors"
                  >
                    <FolderKanban size={13} />
                    Añadir referencia a otro proyecto
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.ai,.png,.jpg,.jpeg"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && addBriefingFiles(e.target.files)}
                  />

                  {/* File list + ref list */}
                  {(form.briefingFiles.length > 0 || form.briefingRefs.length > 0) && (
                    <ul className="mt-3 space-y-2">
                      {form.briefingFiles.map((f, idx) => (
                        <li
                          key={`file-${idx}`}
                          className="flex items-center gap-3 p-2.5 bg-slate-50 border border-border rounded-lg"
                        >
                          <div className="w-8 h-8 rounded-md bg-red-50 text-red-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {f.mimeType.includes('pdf') ? 'PDF' : f.name.split('.').pop()?.toUpperCase().slice(0, 3) ?? 'DOC'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-primary truncate">{f.name}</p>
                            <p className="text-xs text-slate-500">{f.sizeKb.toLocaleString()} KB</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => appendToNotes(f.name)}
                            className="p-1.5 text-slate-400 hover:text-accent transition-colors shrink-0"
                            title="Añadir nombre a notas"
                          >
                            <CornerDownRight size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBriefingFile(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                      {form.briefingRefs.map((r) => (
                        <li
                          key={`ref-${r.id}`}
                          className="flex items-center gap-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          <div className="w-8 h-8 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <FolderKanban size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-primary truncate">{r.name}</p>
                            <p className="text-xs text-slate-500 font-mono">{r.sku}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => appendToNotes(`Ref. ${r.name} (${r.sku})`)}
                            className="p-1.5 text-blue-400 hover:text-accent transition-colors shrink-0"
                            title="Añadir referencia a notas"
                          >
                            <CornerDownRight size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBriefingRef(r.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                            title="Eliminar referencia"
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Field
                  label="Notas del briefing"
                  hint="Resumen visible en la cabecera del proyecto y en la actividad inicial."
                >
                  <textarea
                    ref={notesRef}
                    rows={3}
                    value={form.briefingNotes}
                    onChange={(e) => update('briefingNotes', e.target.value)}
                    placeholder="Claim principal, paleta de color obligatoria, referencias visuales, requisitos legales…"
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                {/* Reference project modal */}
                {refModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                      className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                      onClick={() => setRefModalOpen(false)}
                    />
                    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                        <div>
                          <h3 className="font-semibold text-primary">Añadir referencia</h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Selecciona un proyecto existente como referencia del briefing
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRefModalOpen(false)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="px-5 py-3 border-b border-border">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Buscar por nombre o SKU…"
                            value={refSearch}
                            onChange={(e) => setRefSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-border rounded-md focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                          />
                        </div>
                      </div>
                      <ul className="overflow-y-auto max-h-72 divide-y divide-border">
                        {projects
                          .filter((p) => !p.archived)
                          .filter((p) => {
                            const q = refSearch.toLowerCase();
                            return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
                          })
                          .map((p) => {
                            const already = form.briefingRefs.some((r) => r.id === p.id);
                            return (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  disabled={already}
                                  onClick={() => {
                                    addBriefingRef({ id: p.id, name: p.name, sku: p.sku });
                                    setRefModalOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                                    already
                                      ? 'opacity-40 cursor-not-allowed'
                                      : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="w-8 h-8 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                    <FolderKanban size={14} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary truncate">{p.name}</p>
                                    <p className="text-xs text-slate-400 font-mono">{p.sku} · {p.market}</p>
                                  </div>
                                  {already && (
                                    <Check size={14} className="text-emerald-500 shrink-0" />
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        {projects.filter((p) => !p.archived).length === 0 && (
                          <li className="px-5 py-8 text-sm text-slate-400 text-center">
                            No hay proyectos disponibles
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-border bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
              >
                <X size={16} /> Cancelar
              </button>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => void handleSubmit(true)}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-border bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Guardando…
                    </>
                  ) : (
                    'Guardar borrador'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit(false)}
                  disabled={submitting || (submitAttempted && !isValid)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-md bg-accent text-white hover:bg-accent-hover text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}{' '}
                  {submitting
                    ? 'Creando…'
                    : creationMode === 'version'
                      ? 'Crear versión y notificar equipo'
                      : 'Crear proyecto y notificar equipo'}
                </button>
              </div>
            </div>

            {submitAttempted && !isValid && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                <Info size={16} className="mt-0.5 shrink-0" />
                <span>
                  Revisa los campos marcados — son necesarios para arrancar el flujo de aprobación.
                </span>
              </div>
            )}
            </>
            )}
          </div>

          {/* Side summary */}
          {(creationMode === 'new' || sourceProject) && (
          <aside className="space-y-6 xl:sticky xl:top-6 self-start">

            {/* Version substitution card – only shown when creating a new version */}
            {sourceProject && (
              <Card className="border-amber-200 bg-amber-50/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-amber-800 flex items-center gap-2">
                    <Hash size={15} className="text-amber-600" />
                    Código SAP heredado
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {/* SAP code */}
                  <div className="text-xs text-amber-700 bg-white/70 rounded-md border border-amber-200 px-3 py-2 leading-relaxed">
                    Este producto mantendrá el mismo código SAP que la versión anterior
                    {sourceProject.sapCode
                      ? <> (<span className="font-mono font-semibold">{sourceProject.sapCode}</span>)</>
                      : ''
                    } y <strong>sustituirá su estado de vigencia cuando sea aprobado</strong>.
                  </div>

                  {/* Substitution type toggle */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">
                      Tipo de sustitución
                    </p>
                    <div className="flex gap-2">
                      {(['Permanente', 'Temporal'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, substitutionType: opt, temporalEndDate: '' }))}
                          className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md border transition-colors ${
                            form.substitutionType === opt
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Temporal date input */}
                  {form.substitutionType === 'Temporal' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-amber-700">
                        Fecha fin de la promoción temporal
                      </label>
                      <DateInput
                        value={form.temporalEndDate}
                        onChange={(v) => setForm((p) => ({ ...p, temporalEndDate: v }))}
                        className="w-full px-2.5 py-1.5 border border-amber-300 rounded-md text-sm bg-white text-primary focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                      />
                      {form.temporalEndDate && (
                        <div className="text-xs text-amber-700 bg-white/80 rounded-md border border-amber-200 px-3 py-2 leading-relaxed space-y-1">
                          <p>
                            <span className="font-semibold">Esta versión</span> pasará a{' '}
                            <span className="font-semibold">Vigente</span> cuando el diseño sea aprobado.
                          </p>
                          <p>
                            El <span className="font-semibold">{formatDate(form.temporalEndDate)}</span> volverá
                            a <span className="font-semibold">Obsoleta</span> y la versión anterior
                            recuperará el estado <span className="font-semibold">Vigente</span>.
                          </p>
                          <p className="text-amber-600">
                            Sólo puede haber un producto <strong>Vigente</strong> por código SAP.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Permanent confirmation note */}
                  {form.substitutionType === 'Permanente' && (
                    <p className="text-xs text-amber-600 leading-relaxed">
                      Al aprobarse, la versión anterior pasará a <strong>Obsoleta</strong> de forma permanente.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="bg-gradient-to-br from-accent/5 to-white">
              <CardHeader className="border-b-0 pb-2">
                <CardTitle className="text-base">Vista previa</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Así quedará el proyecto al crearse.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {summary.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-3 text-sm border-b border-border/60 last:border-b-0 pb-2 last:pb-0"
                  >
                    <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
                      {row.label}
                    </span>
                    <span
                      className={`text-right text-primary font-medium ${
                        row.mono ? 'font-mono text-xs' : ''
                      }`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip size={16} className="text-slate-400" />
                  Adjuntos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {form.briefingFiles.length > 0 ? (
                  <div className="space-y-1.5">
                    {form.briefingFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                        <FileText size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate text-xs">{f.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Aún no has adjuntado archivos.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Al crear el proyecto…</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-xs text-slate-500">
                {[
                  'Se notificará al equipo de Diseño y a I+D y Calidad.',
                  'Quedará registrado en el activity feed con el rol que crea.',
                  'El proyecto entra en fase "Diseño" lista para subir el primer arte.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewProject;

import { readFile } from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import { createAttachmentFromBuffer } from '@/lib/server/files';
import { PHASE_TO_STATUS } from '@/lib/server/phase';
import { getAdminClient } from '@/lib/supabase/admin';
import { primaryMarket } from '@/lib/server/workflow';

type RoleName = string;

export type DemoTemplate = {
  project: {
    name: string;
    sku: string;
    flow_type?: string;
    product_line?: string;
    format?: string;
    markets?: string[];
    label_languages?: string[];
    label_languages_front?: string[];
    label_languages_back?: string[];
    launch_date?: string;
    art_deadline?: string;
    description?: string;
    briefing_notes?: string;
    phase: string;
    status?: string;
    lifecycle_status?: string;
    owner_role?: RoleName;
    design_lead_role?: RoleName;
    regulatory_role?: RoleName;
    owner_name?: string;
    design_lead?: string;
    regulatory_contact?: string;
  };
  proposals?: {
    name: string;
    version?: string;
    comments?: string;
    uploaded_role?: string;
    uploaded_phase?: string;
    days_ago?: number;
    /** Rutas relativas dentro del ZIP, p. ej. "files/propuesta-v1.pdf" */
    files?: string[];
  }[];
  phase_actions?: {
    phase: string;
    type: 'approve' | 'reject' | 'comment';
    comment?: string;
    actor_role?: string;
    days_ago?: number;
  }[];
  activity?: {
    type: string;
    text: string;
    actor_role?: string;
    days_ago?: number;
  }[];
  tasks?: {
    title: string;
    role?: string;
    status?: 'Pendiente' | 'Completada';
    priority?: 'Alta' | 'Media' | 'Baja';
    due_days_from_now?: number;
  }[];
  comments?: {
    text: string;
    role?: string;
    resolved?: boolean;
    days_ago?: number;
  }[];
  time_entries?: {
    employee_name: string;
    hours: number;
    description?: string;
    entry_date_days_ago?: number;
  }[];
};

export type DemoBundleFile = {
  buffer: Buffer;
  fileName: string;
};

type DbUser = { id: string; name: string; role: string };

const MAX_DEMO_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_DEMO_ZIP_ENTRIES = 80;

function daysAgoIso(days: number, hour = 12) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function dateFromNow(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function guessMime(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

function normalizeZipPath(raw: string): string {
  return raw.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+/g, '/');
}

function isSafeZipPath(relPath: string): boolean {
  if (!relPath || relPath.startsWith('/') || relPath.includes('\0')) return false;
  const parts = relPath.split('/');
  return parts.every((p) => p !== '..' && p !== '');
}

async function loadDefaultTemplate(): Promise<DemoTemplate> {
  const filePath = path.join(process.cwd(), 'src/data/demo-project.template.json');
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as DemoTemplate;
}

export async function parseDemoArchive(buffer: Buffer): Promise<{
  template: DemoTemplate;
  files: Map<string, DemoBundleFile>;
}> {
  if (buffer.byteLength > MAX_DEMO_ZIP_BYTES) {
    throw new Error(`El ZIP supera el límite de ${Math.round(MAX_DEMO_ZIP_BYTES / (1024 * 1024))} MB`);
  }

  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files).filter((f) => !f.dir);
  if (entries.length > MAX_DEMO_ZIP_ENTRIES) {
    throw new Error(`El ZIP tiene demasiados archivos (máx. ${MAX_DEMO_ZIP_ENTRIES})`);
  }

  const files = new Map<string, DemoBundleFile>();
  const jsonCandidates: { path: string; content: string }[] = [];

  for (const entry of entries) {
    const rel = normalizeZipPath(entry.name);
    if (!isSafeZipPath(rel)) continue;
    if (rel.startsWith('__MACOSX/') || rel.endsWith('.DS_Store')) continue;

    if (rel.toLowerCase().endsWith('.json')) {
      const content = await entry.async('string');
      jsonCandidates.push({ path: rel, content });
      continue;
    }

    const bytes = await entry.async('nodebuffer');
    files.set(rel, {
      buffer: Buffer.from(bytes),
      fileName: path.posix.basename(rel),
    });
    // Also index by basename for convenience
    const base = path.posix.basename(rel);
    if (!files.has(base)) {
      files.set(base, {
        buffer: Buffer.from(bytes),
        fileName: base,
      });
    }
  }

  if (!jsonCandidates.length) {
    throw new Error('El ZIP debe incluir un archivo .json con la plantilla del proyecto');
  }

  const preferred =
    jsonCandidates.find((c) => /(^|\/)demo-project(\.template)?\.json$/i.test(c.path)) ??
    jsonCandidates.find((c) => /(^|\/)demo.*\.json$/i.test(c.path)) ??
    jsonCandidates[0];

  let template: DemoTemplate;
  try {
    template = JSON.parse(preferred.content) as DemoTemplate;
  } catch {
    throw new Error(`JSON inválido en ${preferred.path}`);
  }

  if (!template?.project?.name || !template.project.sku || !template.project.phase) {
    throw new Error('La plantilla JSON debe incluir project.name, project.sku y project.phase');
  }

  return { template, files };
}

async function resolveUsersByRole() {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('id, name, role')
    .eq('status', 'Activo')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const users = (data ?? []) as DbUser[];
  const byRole = new Map<string, DbUser[]>();
  for (const u of users) {
    const list = byRole.get(u.role) ?? [];
    list.push(u);
    byRole.set(u.role, list);
  }
  return { users, byRole };
}

function pickUser(
  byRole: Map<string, DbUser[]>,
  users: DbUser[],
  role?: string,
  preferredName?: string,
  fallbackId?: string,
): DbUser | null {
  if (preferredName) {
    const match = users.find((u) => u.name.toLowerCase() === preferredName.trim().toLowerCase());
    if (match) return match;
  }
  if (role) {
    const list = byRole.get(role);
    if (list?.length) return list[0];
  }
  if (fallbackId) {
    return users.find((u) => u.id === fallbackId) ?? users[0] ?? null;
  }
  return users[0] ?? null;
}

function resolveBundleFile(
  files: Map<string, DemoBundleFile> | undefined,
  ref: string,
): DemoBundleFile | null {
  if (!files?.size) return null;
  const normalized = normalizeZipPath(ref);
  return files.get(normalized) ?? files.get(path.posix.basename(normalized)) ?? null;
}

export async function importDemoProject(options: {
  template?: DemoTemplate;
  actorId: string;
  organizationId: string;
  uniqueSku?: boolean;
  /** Ficheros del ZIP indexados por ruta relativa (y basename). */
  bundleFiles?: Map<string, DemoBundleFile>;
  /** Si true y falta un fichero referenciado, falla. Si false, lo omite. */
  requireReferencedFiles?: boolean;
}): Promise<{ projectId: string; sku: string }> {
  const template = options.template ?? (await loadDefaultTemplate());
  const admin = getAdminClient();
  const { users, byRole } = await resolveUsersByRole();
  if (!users.length) throw new Error('No hay usuarios activos para asignar el demo');
  if (!options.organizationId) throw new Error('organizationId requerido para el proyecto demo');

  const actor =
    users.find((u) => u.id === options.actorId) ??
    pickUser(byRole, users, 'Admin') ??
    users[0];

  const owner =
    pickUser(
      byRole,
      users,
      template.project.owner_role ?? 'Marketing',
      template.project.owner_name,
      actor.id,
    ) ?? actor;
  const designLead = pickUser(
    byRole,
    users,
    template.project.design_lead_role ?? 'Diseño',
    template.project.design_lead,
  );
  const regulatory = pickUser(
    byRole,
    users,
    template.project.regulatory_role ?? 'I+D',
    template.project.regulatory_contact,
  );

  let sku = template.project.sku || 'DEMO-SKU';
  if (options.uniqueSku !== false) {
    const suffix = Date.now().toString(36).slice(-5).toUpperCase();
    sku = `${sku}-${suffix}`;
  } else {
    let existingQuery = admin
      .from('projects')
      .select('id')
      .eq('sku', sku)
      .eq('archived', false)
      .eq('organization_id', options.organizationId);
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError && /organization_id/i.test(existingError.message)) {
      const fallback = await admin
        .from('projects')
        .select('id')
        .eq('sku', sku)
        .eq('archived', false)
        .maybeSingle();
      if (fallback.data) throw new Error(`Ya existe un proyecto activo con SKU ${sku}`);
    } else if (existing) {
      throw new Error(`Ya existe un proyecto activo con SKU ${sku}`);
    }
  }

  const markets = template.project.markets ?? ['ES'];
  const { label, code } = primaryMarket(markets);
  const phase = template.project.phase || 'Diseño';
  const status = template.project.status || PHASE_TO_STATUS[phase] || 'En diseño';

  const insertPayload: Record<string, unknown> = {
    name: template.project.name,
    sku,
    market: label,
    language: code,
    flow_type: template.project.flow_type ?? 'Nacional',
    status,
    phase,
    owner_id: owner.id,
    target_date: template.project.launch_date ?? dateFromNow(60),
    description: template.project.description ?? null,
    lifecycle_status: template.project.lifecycle_status ?? 'Borrador',
    version: 1,
    product_line: template.project.product_line ?? null,
    format: template.project.format ?? null,
    markets,
    label_languages: template.project.label_languages ?? [],
    label_languages_front: template.project.label_languages_front ?? [],
    label_languages_back: template.project.label_languages_back ?? [],
    launch_date: template.project.launch_date ?? null,
    art_deadline: template.project.art_deadline ?? null,
    regulatory_contact: regulatory?.name ?? template.project.regulatory_contact ?? null,
    design_lead: designLead?.name ?? template.project.design_lead ?? null,
    marketing_assignee_type: 'user',
    regulatory_assignee_type: 'user',
    briefing: {
      notes: template.project.briefing_notes ?? null,
      refs: [],
      files: [],
    },
    organization_id: options.organizationId,
    created_at: daysAgoIso(Math.max(...(template.activity ?? []).map((a) => a.days_ago ?? 0), 1)),
  };

  let { data: project, error } = await admin
    .from('projects')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error && /organization_id/i.test(error.message)) {
    delete insertPayload.organization_id;
    const retry = await admin.from('projects').insert(insertPayload).select('id').single();
    project = retry.data;
    error = retry.error;
  }

  if (error || !project) throw new Error(error?.message || 'No se pudo crear el proyecto demo');
  const projectId = project.id as string;

  for (const p of template.proposals ?? []) {
    const uploader =
      pickUser(byRole, users, p.uploaded_role ?? 'Diseño') ?? designLead ?? actor;
    const { data: proposal, error: proposalError } = await admin
      .from('design_proposals')
      .insert({
        project_id: projectId,
        name: p.name,
        version: p.version ?? null,
        comments: p.comments ?? null,
        uploaded_by: uploader.id,
        uploaded_role: p.uploaded_role ?? uploader.role,
        uploaded_phase: p.uploaded_phase ?? 'Diseño',
        created_at: daysAgoIso(p.days_ago ?? 7),
      })
      .select('id')
      .single();

    if (proposalError || !proposal) {
      throw new Error(proposalError?.message || `No se pudo crear la propuesta ${p.name}`);
    }

    for (const fileRef of p.files ?? []) {
      const bundleFile = resolveBundleFile(options.bundleFiles, fileRef);
      if (!bundleFile) {
        if (options.requireReferencedFiles) {
          throw new Error(`Falta el archivo referenciado en la plantilla: ${fileRef}`);
        }
        continue;
      }
      const attachment = await createAttachmentFromBuffer(
        bundleFile.buffer,
        bundleFile.fileName,
        `projects/${projectId}/proposals`,
        guessMime(bundleFile.fileName),
      );
      const { error: linkError } = await admin.from('design_proposal_attachments').insert({
        proposal_id: proposal.id,
        attachment_id: attachment.id,
      });
      if (linkError) {
        throw new Error(linkError.message || `No se pudo vincular ${fileRef} a la propuesta`);
      }
    }
  }

  for (const action of template.phase_actions ?? []) {
    const actorUser = pickUser(byRole, users, action.actor_role ?? 'Marketing') ?? actor;
    const { error: actionError } = await admin.from('phase_actions').insert({
      project_id: projectId,
      phase: action.phase,
      type: action.type,
      comment: action.comment ?? null,
      actor_id: actorUser.id,
      role: action.actor_role ?? actorUser.role,
      created_at: daysAgoIso(action.days_ago ?? 1),
    });
    if (actionError) throw new Error(actionError.message);
  }

  for (const event of template.activity ?? []) {
    const actorUser = pickUser(byRole, users, event.actor_role ?? 'Admin') ?? actor;
    const { error: activityError } = await admin.from('activity_events').insert({
      project_id: projectId,
      type: event.type,
      text: event.text,
      actor_id: actorUser.id,
      created_at: daysAgoIso(event.days_ago ?? 1),
    });
    if (activityError) throw new Error(activityError.message);
  }

  for (const task of template.tasks ?? []) {
    const ownerUser = pickUser(byRole, users, task.role) ?? null;
    const { error: taskError } = await admin.from('tasks').insert({
      project_id: projectId,
      title: task.title,
      owner_id: ownerUser?.id ?? null,
      role: task.role ?? ownerUser?.role ?? null,
      status: task.status ?? 'Pendiente',
      priority: task.priority ?? 'Media',
      due_date:
        task.due_days_from_now != null ? dateFromNow(task.due_days_from_now) : null,
    });
    if (taskError) throw new Error(taskError.message);
  }

  for (const comment of template.comments ?? []) {
    const author = pickUser(byRole, users, comment.role) ?? actor;
    const { error: commentError } = await admin.from('comments').insert({
      project_id: projectId,
      author_id: author.id,
      role: comment.role ?? author.role,
      text: comment.text,
      resolved: Boolean(comment.resolved),
      created_at: daysAgoIso(comment.days_ago ?? 1),
    });
    if (commentError) throw new Error(commentError.message);
  }

  for (const entry of template.time_entries ?? []) {
    const { error: teError } = await admin.from('time_entries').insert({
      project_id: projectId,
      employee_name: entry.employee_name,
      hours: entry.hours,
      description: entry.description ?? null,
      worked_on: dateFromNow(-(entry.entry_date_days_ago ?? 1)),
      created_by: actor.id,
    });
    if (teError) {
      console.warn('[demoProject] time_entries omitido:', teError.message);
      break;
    }
  }

  return { projectId, sku };
}

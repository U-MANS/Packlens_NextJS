import { readFile } from 'fs/promises';
import path from 'path';
import { PHASE_TO_STATUS } from '@/lib/server/phase';
import { getAdminClient } from '@/lib/supabase/admin';
import { primaryMarket } from '@/lib/server/workflow';

type RoleName = string;

type DemoTemplate = {
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

type DbUser = { id: string; name: string; role: string };

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

async function loadDefaultTemplate(): Promise<DemoTemplate> {
  const filePath = path.join(process.cwd(), 'src/data/demo-project.template.json');
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as DemoTemplate;
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

export async function importDemoProject(options?: {
  template?: DemoTemplate;
  actorId: string;
  uniqueSku?: boolean;
}): Promise<{ projectId: string; sku: string }> {
  const template = options?.template ?? (await loadDefaultTemplate());
  const admin = getAdminClient();
  const { users, byRole } = await resolveUsersByRole();
  if (!users.length) throw new Error('No hay usuarios activos para asignar el demo');

  const actor =
    users.find((u) => u.id === options?.actorId) ??
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
  if (options?.uniqueSku !== false) {
    const suffix = Date.now().toString(36).slice(-5).toUpperCase();
    sku = `${sku}-${suffix}`;
  } else {
    const { data: existing } = await admin
      .from('projects')
      .select('id')
      .eq('sku', sku)
      .eq('archived', false)
      .maybeSingle();
    if (existing) throw new Error(`Ya existe un proyecto activo con SKU ${sku}`);
  }

  const markets = template.project.markets ?? ['ES'];
  const { label, code } = primaryMarket(markets);
  const phase = template.project.phase || 'Diseño';
  const status = template.project.status || PHASE_TO_STATUS[phase] || 'En diseño';

  const { data: project, error } = await admin
    .from('projects')
    .insert({
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
      created_at: daysAgoIso(Math.max(...(template.activity ?? []).map((a) => a.days_ago ?? 0), 1)),
    })
    .select('id')
    .single();

  if (error || !project) throw new Error(error?.message || 'No se pudo crear el proyecto demo');
  const projectId = project.id as string;

  for (const p of template.proposals ?? []) {
    const uploader =
      pickUser(byRole, users, p.uploaded_role ?? 'Diseño') ?? designLead ?? actor;
    await admin.from('design_proposals').insert({
      project_id: projectId,
      name: p.name,
      version: p.version ?? null,
      comments: p.comments ?? null,
      uploaded_by: uploader.id,
      uploaded_role: p.uploaded_role ?? uploader.role,
      uploaded_phase: p.uploaded_phase ?? 'Diseño',
      created_at: daysAgoIso(p.days_ago ?? 7),
    });
  }

  for (const action of template.phase_actions ?? []) {
    const actorUser = pickUser(byRole, users, action.actor_role ?? 'Marketing') ?? actor;
    await admin.from('phase_actions').insert({
      project_id: projectId,
      phase: action.phase,
      type: action.type,
      comment: action.comment ?? null,
      actor_id: actorUser.id,
      role: action.actor_role ?? actorUser.role,
      created_at: daysAgoIso(action.days_ago ?? 1),
    });
  }

  for (const event of template.activity ?? []) {
    const actorUser = pickUser(byRole, users, event.actor_role ?? 'Admin') ?? actor;
    await admin.from('activity_events').insert({
      project_id: projectId,
      type: event.type,
      text: event.text,
      actor_id: actorUser.id,
      created_at: daysAgoIso(event.days_ago ?? 1),
    });
  }

  for (const task of template.tasks ?? []) {
    const ownerUser = pickUser(byRole, users, task.role) ?? null;
    await admin.from('tasks').insert({
      project_id: projectId,
      title: task.title,
      owner_id: ownerUser?.id ?? null,
      role: task.role ?? ownerUser?.role ?? null,
      status: task.status ?? 'Pendiente',
      priority: task.priority ?? 'Media',
      due_date:
        task.due_days_from_now != null ? dateFromNow(task.due_days_from_now) : null,
    });
  }

  for (const comment of template.comments ?? []) {
    const author = pickUser(byRole, users, comment.role) ?? actor;
    await admin.from('comments').insert({
      project_id: projectId,
      author_id: author.id,
      role: comment.role ?? author.role,
      text: comment.text,
      resolved: Boolean(comment.resolved),
      created_at: daysAgoIso(comment.days_ago ?? 1),
    });
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

export type { DemoTemplate };

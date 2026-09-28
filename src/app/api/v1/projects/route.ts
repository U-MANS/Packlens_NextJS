import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { projectsToRead } from '@/lib/server/serializers';
import { addActivity, primaryMarket, reloadProject } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';
import { initialPhaseForFlow, PHASE_TO_STATUS } from '@/lib/server/phase';

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const phase = searchParams.get('phase');
  const lifecycleStatus = searchParams.get('lifecycle_status');
  const archivedParam = searchParams.get('archived');
  const market = searchParams.get('market');
  const productLine = searchParams.get('product_line');

  const admin = getAdminClient();
  let query = admin
    .from('projects')
    .select('*, owner_user:users!projects_owner_id_fkey(name)')
    .order('created_at', { ascending: false });

  if (archivedParam === null || archivedParam === 'false') {
    query = query.eq('archived', false);
  } else if (archivedParam === 'true') {
    query = query.eq('archived', true);
  }

  if (phase) query = query.eq('phase', phase);
  if (lifecycleStatus) query = query.eq('lifecycle_status', lifecycleStatus);
  if (productLine) query = query.eq('product_line', productLine);
  if (market) query = query.eq('market', market);
  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[projects]', error);
    return jsonError(error.message, 500);
  }

  return jsonOk(await projectsToRead((data ?? []) as Parameters<typeof projectsToRead>[0]));
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const body = (await request.json()) as {
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
    owner_name?: string;
    design_lead?: string;
    regulatory_contact?: string;
    marketing_assignee_type?: 'user' | 'agent';
    marketing_agent_id?: string;
    regulatory_assignee_type?: 'user' | 'agent';
    regulatory_agent_id?: string;
    description?: string;
    briefing_notes?: string;
    briefing_refs?: { id: string; name: string; sku: string }[];
    substitution_type?: string;
    temporal_end_date?: string;
  };

  if (!body.name || !body.sku) return jsonError('name y sku son obligatorios', 400);
  if (body.art_deadline && body.launch_date && body.art_deadline >= body.launch_date) {
    return jsonError('art_deadline debe ser anterior a launch_date', 400);
  }

  const marketingType = body.marketing_assignee_type === 'agent' ? 'agent' : 'user';
  const regulatoryType = body.regulatory_assignee_type === 'agent' ? 'agent' : 'user';
  if (marketingType === 'agent' && !body.marketing_agent_id) {
    return jsonError('Selecciona un agente de Marketing', 400);
  }
  if (regulatoryType === 'agent' && !body.regulatory_agent_id) {
    return jsonError('Selecciona un agente de I+D', 400);
  }
  if (marketingType === 'user' && !body.owner_name) {
    return jsonError('Asigna un responsable de Marketing', 400);
  }

  const admin = getAdminClient();
  const { data: existing } = await admin
    .from('projects')
    .select('id')
    .eq('sku', body.sku)
    .eq('archived', false)
    .maybeSingle();
  if (existing) return jsonError(`Ya existe un proyecto activo con SKU ${body.sku}`, 409);

  let ownerId = user.id;
  if (marketingType === 'user' && body.owner_name) {
    const { data: owner } = await admin
      .from('users')
      .select('id')
      .ilike('name', body.owner_name.trim())
      .maybeSingle();
    if (owner) ownerId = owner.id;
  }

  if (marketingType === 'agent' && body.marketing_agent_id) {
    const { data: mag } = await admin
      .from('agents')
      .select('id, role, status')
      .eq('id', body.marketing_agent_id)
      .maybeSingle();
    if (!mag || mag.role !== 'Marketing' || mag.status !== 'Activo') {
      return jsonError('Agente de Marketing inválido o inactivo', 400);
    }
  }
  if (regulatoryType === 'agent' && body.regulatory_agent_id) {
    const { data: rag } = await admin
      .from('agents')
      .select('id, role, status')
      .eq('id', body.regulatory_agent_id)
      .maybeSingle();
    if (!rag || rag.role !== 'I+D' || rag.status !== 'Activo') {
      return jsonError('Agente de I+D inválido o inactivo', 400);
    }
  }

  const { label, code } = primaryMarket(body.markets);
  const briefing = {
    notes: body.briefing_notes ?? null,
    refs: body.briefing_refs ?? [],
    files: [],
  };

  const flowType = body.flow_type ?? null;
  const initialPhase = initialPhaseForFlow(flowType);

  const { data: project, error } = await admin
    .from('projects')
    .insert({
      name: body.name,
      sku: body.sku,
      market: label,
      language: code,
      flow_type: flowType,
      status: PHASE_TO_STATUS[initialPhase] ?? 'En diseño',
      phase: initialPhase,
      owner_id: ownerId,
      target_date: body.launch_date ?? new Date().toISOString().slice(0, 10),
      description: body.description ?? null,
      lifecycle_status: 'Borrador',
      version: 1,
      product_line: body.product_line ?? null,
      format: body.format ?? null,
      markets: body.markets ?? [],
      label_languages: body.label_languages ?? [],
      label_languages_front: body.label_languages_front ?? [],
      label_languages_back: body.label_languages_back ?? [],
      launch_date: body.launch_date ?? null,
      art_deadline: body.art_deadline ?? null,
      regulatory_contact: regulatoryType === 'user' ? (body.regulatory_contact ?? null) : null,
      design_lead: body.design_lead ?? null,
      marketing_assignee_type: marketingType,
      marketing_agent_id: marketingType === 'agent' ? body.marketing_agent_id : null,
      regulatory_assignee_type: regulatoryType,
      regulatory_agent_id: regulatoryType === 'agent' ? body.regulatory_agent_id : null,
      briefing,
      substitution_type: body.substitution_type ?? null,
      temporal_end_date: body.temporal_end_date ?? null,
    })
    .select('id')
    .single();

  if (error || !project) return jsonError(error?.message || 'Error creando proyecto', 500);
  await addActivity(project.id, user.id, 'PROJECT_CREATED', `Proyecto creado: ${body.name}`);
  return jsonOk(await reloadProject(project.id), { status: 201 });
}

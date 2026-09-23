import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { addActivity, getProjectRow, reloadProject } from '@/lib/server/workflow';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const source = await getProjectRow(id);
  if (!source) return jsonError('Proyecto no encontrado', 404);

  const url = new URL(request.url);
  const substitution_type = url.searchParams.get('substitution_type');
  const temporal_end_date = url.searchParams.get('temporal_end_date');

  const admin = getAdminClient();
  const base = String(source.sku).replace(/-\d{3}$/, '');
  const { data: versions } = await admin.from('projects').select('version').like('sku', `${base}%`);
  const maxVersion = Math.max(source.version as number, ...(versions ?? []).map((v) => Number(v.version) || 0));
  const nextVersion = maxVersion + 1;
  const newSku = `${base}-${String(nextVersion).padStart(3, '0')}`;

  const { data: created, error } = await admin
    .from('projects')
    .insert({
      name: source.name,
      sku: newSku,
      market: source.market,
      language: source.language,
      flow_type: source.flow_type,
      status: 'En diseño',
      phase: 'Diseño',
      owner_id: source.owner_id,
      target_date: source.target_date,
      description: source.description,
      lifecycle_status: 'Borrador',
      version: nextVersion,
      previous_version_id: source.id,
      substitution_type,
      temporal_end_date,
      product_line: source.product_line,
      format: source.format,
      markets: source.markets,
      label_languages: source.label_languages,
      label_languages_front: source.label_languages_front,
      label_languages_back: source.label_languages_back,
      launch_date: source.launch_date,
      art_deadline: source.art_deadline,
      regulatory_contact: source.regulatory_contact,
      design_lead: source.design_lead,
      briefing: source.briefing,
      sap_code: source.sap_code,
    })
    .select('id')
    .single();

  if (error || !created) return jsonError(error?.message || 'Error creando versión', 500);
  await addActivity(
    created.id,
    user.id,
    'NEW_VERSION',
    `Nueva versión v${nextVersion} creada desde v${source.version}`,
  );
  return jsonOk(await reloadProject(created.id), { status: 201 });
}

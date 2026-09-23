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

  const admin = getAdminClient();
  const skuBase = String(source.sku).replace(/-\d{3}$/, '');
  const { data: clone, error } = await admin
    .from('projects')
    .insert({
      name: `${source.name} (copia)`,
      sku: `${skuBase}-copy-${Date.now()}`,
      market: source.market,
      language: source.language,
      flow_type: source.flow_type,
      status: 'En diseño',
      phase: 'Diseño',
      owner_id: source.owner_id,
      target_date: source.target_date,
      description: source.description,
      lifecycle_status: 'Borrador',
      version: 1,
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
    })
    .select('id')
    .single();

  if (error || !clone) return jsonError(error?.message || 'Error clonando', 500);
  await addActivity(clone.id, user.id, 'PROJECT_CREATED', `Proyecto clonado desde ${source.name}`);
  return jsonOk(await reloadProject(clone.id), { status: 201 });
}

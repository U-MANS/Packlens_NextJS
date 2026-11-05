import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { importDemoProject, type DemoTemplate } from '@/lib/server/demoProject';
import { jsonError, jsonOk } from '@/lib/server/http';
import { canManageUsers } from '@/lib/server/permissions';
import { reloadProject } from '@/lib/server/workflow';

/**
 * POST /api/v1/projects/demo
 * Crea un proyecto demo a partir de la plantilla JSON (o un body personalizado).
 * Solo Admin.
 *
 * Body opcional:
 * - template: objeto DemoTemplate completo (si no, usa src/data/demo-project.template.json)
 * - unique_sku: boolean (default true) — añade sufijo al SKU para evitar colisiones
 */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!canManageUsers(user)) {
    return jsonError('Solo Admin puede crear proyectos demo', 403);
  }

  let body: { template?: DemoTemplate; unique_sku?: boolean } = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as typeof body;
  } catch {
    return jsonError('JSON inválido', 400);
  }

  try {
    const { projectId, sku } = await importDemoProject({
      template: body.template,
      actorId: user.id,
      uniqueSku: body.unique_sku !== false,
    });
    const project = await reloadProject(projectId);
    return jsonOk({ project, sku, message: `Proyecto demo creado (${sku})` }, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error creando proyecto demo', 500);
  }
}

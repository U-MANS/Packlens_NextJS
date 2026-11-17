import { NextRequest } from 'next/server';
import {
  importDemoProject,
  parseDemoArchive,
  type DemoTemplate,
} from '@/lib/server/demoProject';
import { jsonError, jsonOk } from '@/lib/server/http';
import { requireOrg } from '@/lib/server/org';
import { canManageUsers } from '@/lib/server/permissions';
import { reloadProject } from '@/lib/server/workflow';

/**
 * POST /api/v1/projects/demo
 * Crea un proyecto demo a partir de la plantilla JSON (o un ZIP con JSON + ficheros).
 * Solo Admin/Manager, en la organización activa.
 *
 * Body JSON:
 * - template: objeto DemoTemplate completo (si no, usa src/data/demo-project.template.json)
 * - unique_sku: boolean (default true)
 *
 * Body multipart/form-data:
 * - archive: archivo .zip (JSON + files/*)
 * - unique_sku: "true" | "false"
 * - template: (opcional) JSON string si se envía sin ZIP
 */
export async function POST(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  if (!canManageUsers(ctx.user)) {
    return jsonError('Solo Admin/Manager puede crear proyectos demo', 403);
  }

  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const uniqueSku = String(form.get('unique_sku') ?? 'true') !== 'false';
      const archive = form.get('archive');

      if (archive instanceof File && archive.size > 0) {
        const name = archive.name.toLowerCase();
        if (!name.endsWith('.zip') && archive.type !== 'application/zip' && archive.type !== 'application/x-zip-compressed') {
          return jsonError('El archivo debe ser un .zip', 400);
        }
        const buffer = Buffer.from(await archive.arrayBuffer());
        const { template, files } = await parseDemoArchive(buffer);
        const { projectId, sku } = await importDemoProject({
          template,
          actorId: ctx.user.id,
          organizationId: ctx.organizationId,
          uniqueSku,
          bundleFiles: files,
          requireReferencedFiles: true,
        });
        const project = await reloadProject(projectId);
        return jsonOk(
          { project, sku, message: `Proyecto demo creado (${sku})` },
          { status: 201 },
        );
      }

      const templateRaw = form.get('template');
      let template: DemoTemplate | undefined;
      if (typeof templateRaw === 'string' && templateRaw.trim()) {
        template = JSON.parse(templateRaw) as DemoTemplate;
      }
      const { projectId, sku } = await importDemoProject({
        template,
        actorId: ctx.user.id,
        organizationId: ctx.organizationId,
        uniqueSku,
        requireReferencedFiles: false,
      });
      const project = await reloadProject(projectId);
      return jsonOk(
        { project, sku, message: `Proyecto demo creado (${sku})` },
        { status: 201 },
      );
    }

    let body: { template?: DemoTemplate; unique_sku?: boolean } = {};
    try {
      const text = await request.text();
      if (text.trim()) body = JSON.parse(text) as typeof body;
    } catch {
      return jsonError('JSON inválido', 400);
    }

    const { projectId, sku } = await importDemoProject({
      template: body.template,
      actorId: ctx.user.id,
      organizationId: ctx.organizationId,
      uniqueSku: body.unique_sku !== false,
      requireReferencedFiles: false,
    });
    const project = await reloadProject(projectId);
    return jsonOk({ project, sku, message: `Proyecto demo creado (${sku})` }, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error creando proyecto demo', 500);
  }
}

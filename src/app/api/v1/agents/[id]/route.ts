import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import {
  agentToApi,
  canManageAgents,
  getAgent,
  type AgentRole,
  type DbAgent,
} from '@/lib/server/agents';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_ROLES = new Set<AgentRole>(['Marketing', 'I+D']);

export async function GET(request: NextRequest, context: Ctx) {
  const current = await requireUser(request);
  if (current instanceof Response) return current;
  const { id } = await context.params;
  try {
    const agent = await getAgent(id);
    if (!agent) return jsonError('Agente no encontrado', 404);
    return jsonOk(agentToApi(agent));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error', 500);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const current = await requireUser(request);
  if (current instanceof Response) return current;
  if (!canManageAgents(current)) return jsonError('Solo Admin puede actualizar agentes', 403);

  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    prompt?: string;
    role?: string;
    status?: string;
  };

  const existing = await getAgent(id);
  if (!existing) return jsonError('Agente no encontrado', 404);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return jsonError('Nombre obligatorio', 400);
    updates.name = name;
  }
  if (body.prompt !== undefined) {
    const prompt = body.prompt.trim();
    if (!prompt) return jsonError('Prompt obligatorio', 400);
    updates.prompt = prompt;
  }
  if (body.role !== undefined) {
    if (!ALLOWED_ROLES.has(body.role as AgentRole)) {
      return jsonError('Rol debe ser Marketing o I+D', 400);
    }
    updates.role = body.role;
  }
  if (body.status !== undefined) {
    if (body.status !== 'Activo' && body.status !== 'Inactivo') {
      return jsonError('Estado inválido', 400);
    }
    updates.status = body.status;
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('agents')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) return jsonError(error?.message || 'Error actualizando', 500);
  return jsonOk(agentToApi(data as DbAgent));
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const current = await requireUser(request);
  if (current instanceof Response) return current;
  if (!canManageAgents(current)) return jsonError('Solo Admin puede eliminar agentes', 403);

  const { id } = await context.params;
  const existing = await getAgent(id);
  if (!existing) return jsonError('Agente no encontrado', 404);

  const admin = getAdminClient();
  const { error } = await admin.from('agents').delete().eq('id', id);
  if (error) return jsonError(error.message, 500);
  return new Response(null, { status: 204 });
}

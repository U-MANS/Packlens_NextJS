import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import {
  agentToApi,
  canManageAgents,
  listAgents,
  type AgentRole,
  type DbAgent,
} from '@/lib/server/agents';
import { getAdminClient } from '@/lib/supabase/admin';

const ALLOWED_ROLES = new Set<AgentRole>(['Marketing', 'I+D']);

export async function GET(request: NextRequest) {
  const current = await requireUser(request);
  if (current instanceof Response) return current;

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  try {
    const agents = await listAgents({ role, status });
    return jsonOk(agents.map(agentToApi));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error listando agentes', 500);
  }
}

export async function POST(request: NextRequest) {
  const current = await requireUser(request);
  if (current instanceof Response) return current;
  if (!canManageAgents(current)) return jsonError('Solo Admin puede crear agentes', 403);

  const body = (await request.json()) as {
    name?: string;
    prompt?: string;
    role?: string;
    status?: string;
  };

  const name = body.name?.trim() ?? '';
  const prompt = body.prompt?.trim() ?? '';
  const role = body.role as AgentRole;
  if (!name) return jsonError('Nombre obligatorio', 400);
  if (!prompt) return jsonError('Prompt obligatorio', 400);
  if (!ALLOWED_ROLES.has(role)) return jsonError('Rol debe ser Marketing o I+D', 400);

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('agents')
    .insert({
      name,
      prompt,
      role,
      status: body.status === 'Inactivo' ? 'Inactivo' : 'Activo',
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !data) return jsonError(error?.message || 'Error creando agente', 500);
  return jsonOk(agentToApi(data as DbAgent), { status: 201 });
}

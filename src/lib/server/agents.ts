import { getAdminClient } from '@/lib/supabase/admin';
import { canManageUsers } from '@/lib/server/permissions';
import type { DbUser } from '@/lib/server/auth';

export type AgentRole = 'Marketing' | 'I+D';
export type AgentStatus = 'Activo' | 'Inactivo';

export type DbAgent = {
  id: string;
  name: string;
  prompt: string;
  role: AgentRole;
  status: AgentStatus;
  created_at: string;
  updated_at: string;
};

export function agentToApi(agent: DbAgent) {
  return {
    id: agent.id,
    name: agent.name,
    prompt: agent.prompt,
    role: agent.role,
    status: agent.status,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
  };
}

export function canManageAgents(user: DbUser): boolean {
  return canManageUsers(user);
}

export async function listAgents(params?: {
  role?: string;
  status?: string;
}): Promise<DbAgent[]> {
  const admin = getAdminClient();
  let query = admin.from('agents').select('*').order('name');
  if (params?.role) query = query.eq('role', params.role);
  if (params?.status) query = query.eq('status', params.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as DbAgent[];
}

export async function getAgent(id: string): Promise<DbAgent | null> {
  const admin = getAdminClient();
  const { data, error } = await admin.from('agents').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DbAgent | null) ?? null;
}

import { getAdminClient } from '@/lib/supabase/admin';
import { getUserFromAccessToken } from '@/lib/supabase/auth';
import { jsonError } from '@/lib/server/http';

export type DbUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  initials: string | null;
  joined_at: string | null;
  created_at: string;
};

export function userToApi(user: DbUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    initials: user.initials,
    joined_at: user.joined_at,
    created_at: user.created_at,
  };
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export async function requireUser(request: Request): Promise<DbUser | Response> {
  const token = bearerToken(request);
  if (!token) return jsonError('No autenticado', 401);

  const authUser = await getUserFromAccessToken(token);
  if (!authUser?.id) return jsonError('Token inválido', 401);

  const admin = getAdminClient();
  const { data, error } = await admin.from('users').select('*').eq('id', authUser.id).maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) {
    return jsonError('Perfil de usuario no encontrado. ¿Ejecutaste 02_auth_profiles.sql?', 401);
  }

  const user = data as DbUser;
  if (user.status !== 'Activo') return jsonError('Usuario inactivo', 403);
  return user;
}

import { NextRequest } from 'next/server';
import { requireUser, userToApi } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { canManageUsers, isValidUserRole, USER_ROLES } from '@/lib/server/permissions';
import { getAdminClient } from '@/lib/supabase/admin';
import { adminDeleteUser, adminUpdateUserMetadata } from '@/lib/supabase/admin-users';

type Ctx = { params: Promise<{ id: string }> };

async function countActiveAdmins(excludeId?: string): Promise<number> {
  const admin = getAdminClient();
  let query = admin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'Admin')
    .eq('status', 'Activo');
  if (excludeId) query = query.neq('id', excludeId);
  const { count } = await query;
  return count ?? 0;
}

export async function GET(request: NextRequest, context: Ctx) {
  const current = await requireUser(request);
  if (current instanceof Response) return current;
  const { id } = await context.params;
  const admin = getAdminClient();
  const { data, error } = await admin.from('users').select('*').eq('id', id).maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError('Usuario no encontrado', 404);
  return jsonOk(userToApi(data as Parameters<typeof userToApi>[0]));
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const current = await requireUser(request);
  if (current instanceof Response) return current;
  if (!canManageUsers(current)) return jsonError('Solo Admin puede actualizar usuarios', 403);

  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    role?: string;
    status?: string;
    initials?: string;
    password?: string;
  };
  if (body.password) {
    return jsonError('Cambio de contraseña: usar Supabase Dashboard o reset password', 400);
  }
  if (body.role !== undefined && !isValidUserRole(body.role)) {
    return jsonError(`Rol no válido. Usa: ${USER_ROLES.join(', ')}`, 400);
  }
  if (body.status !== undefined && body.status !== 'Activo' && body.status !== 'Inactivo') {
    return jsonError("Estado no válido. Usa: Activo o Inactivo", 400);
  }

  const admin = getAdminClient();
  const { data: existing } = await admin.from('users').select('*').eq('id', id).maybeSingle();
  if (!existing) return jsonError('Usuario no encontrado', 404);

  const wasActiveAdmin = existing.role === 'Admin' && existing.status === 'Activo';
  const nextRole = body.role ?? existing.role;
  const nextStatus = body.status ?? existing.status;
  const willRemainActiveAdmin = nextRole === 'Admin' && nextStatus === 'Activo';

  if (wasActiveAdmin && !willRemainActiveAdmin) {
    const others = await countActiveAdmins(id);
    if (others < 1) {
      return jsonError(
        'No puedes quitar el rol Admin ni desactivar al único administrador activo',
        400,
      );
    }
  }

  const updates: Record<string, unknown> = {};
  for (const key of ['name', 'role', 'status', 'initials'] as const) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const { data, error } = await admin.from('users').update(updates).eq('id', id).select('*').single();
  if (error || !data) return jsonError(error?.message || 'Error actualizando', 500);

  if (body.role || body.name || body.initials) {
    await adminUpdateUserMetadata(id, {
      name: data.name,
      role: data.role,
      initials: data.initials || '',
    });
  }

  return jsonOk(userToApi(data as Parameters<typeof userToApi>[0]));
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const current = await requireUser(request);
  if (current instanceof Response) return current;
  if (!canManageUsers(current)) return jsonError('Solo Admin puede eliminar usuarios', 403);

  const { id } = await context.params;
  if (id === current.id) return jsonError('No puedes eliminar tu propia cuenta', 400);

  const admin = getAdminClient();
  const { data } = await admin.from('users').select('id').eq('id', id).maybeSingle();
  if (!data) return jsonError('Usuario no encontrado', 404);

  try {
    await adminDeleteUser(id);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error eliminando usuario', 500);
  }
  return new Response(null, { status: 204 });
}

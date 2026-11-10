import { NextRequest } from 'next/server';
import { userToApi } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { requireOrg } from '@/lib/server/org';
import {
  canAssignRole,
  canManageUsers,
  isValidUserRole,
  USER_ROLES,
} from '@/lib/server/permissions';
import { getAdminClient } from '@/lib/supabase/admin';
import { adminDeleteUser, adminUpdateUserMetadata } from '@/lib/supabase/admin-users';

type Ctx = { params: Promise<{ id: string }> };

async function countActiveAdmins(
  organizationId: string,
  excludeId?: string
): Promise<number> {
  const admin = getAdminClient();
  let query = admin
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('role', 'Admin')
    .eq('status', 'Activo');
  if (excludeId) query = query.neq('user_id', excludeId);
  const { count, error } = await query;
  if (!error) return count ?? 0;

  let fallback = admin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'Admin')
    .eq('status', 'Activo');
  if (excludeId) fallback = fallback.neq('id', excludeId);
  const res = await fallback;
  return res.count ?? 0;
}

export async function GET(request: NextRequest, context: Ctx) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  const { id } = await context.params;
  const admin = getAdminClient();
  const { data: membership } = await admin
    .from('memberships')
    .select('role, status, user:users(*)')
    .eq('organization_id', ctx.organizationId)
    .eq('user_id', id)
    .maybeSingle();
  if (membership?.user && !Array.isArray(membership.user)) {
    const u = membership.user as unknown as Parameters<typeof userToApi>[0];
    return jsonOk(
      userToApi({
        ...u,
        role: membership.role || u.role,
        status: membership.status || u.status,
      })
    );
  }
  const { data, error } = await admin.from('users').select('*').eq('id', id).maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError('Usuario no encontrado', 404);
  return jsonOk(userToApi(data as Parameters<typeof userToApi>[0]));
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  const current = ctx.user;
  if (!canManageUsers(current, ctx.config)) {
    return jsonError('Sin permiso para actualizar usuarios', 403);
  }

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

  const nextRole = body.role ?? existing.role;
  const nextStatus = body.status ?? existing.status;

  if (
    !canAssignRole(current, nextRole, { targetCurrentRole: existing.role }) ||
    (body.status !== undefined &&
      !canAssignRole(current, existing.role, { targetCurrentRole: existing.role }))
  ) {
    return jsonError('No puedes modificar usuarios Admin de plataforma', 403);
  }

  const wasActiveAdmin = existing.role === 'Admin' && existing.status === 'Activo';
  const willRemainActiveAdmin = nextRole === 'Admin' && nextStatus === 'Activo';

  if (wasActiveAdmin && !willRemainActiveAdmin) {
    const others = await countActiveAdmins(ctx.organizationId, id);
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

  if (body.role !== undefined || body.status !== undefined) {
    await admin.from('memberships').upsert(
      {
        user_id: id,
        organization_id: ctx.organizationId,
        role: nextRole,
        status: nextStatus === 'Inactivo' ? 'Inactivo' : 'Activo',
      },
      { onConflict: 'user_id,organization_id' }
    );
  }

  if (body.role || body.name || body.initials) {
    await adminUpdateUserMetadata(id, {
      name: data.name,
      role: data.role,
      initials: data.initials || '',
    });
  }

  return jsonOk(
    userToApi({
      ...(data as Parameters<typeof userToApi>[0]),
      role: nextRole,
      status: nextStatus,
    })
  );
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  const current = ctx.user;
  if (!canManageUsers(current, ctx.config)) {
    return jsonError('Sin permiso para eliminar usuarios', 403);
  }

  const { id } = await context.params;
  if (id === current.id) return jsonError('No puedes eliminar tu propia cuenta', 400);

  const admin = getAdminClient();
  const { data } = await admin.from('users').select('id, role').eq('id', id).maybeSingle();
  if (!data) return jsonError('Usuario no encontrado', 404);
  if (!canAssignRole(current, data.role, { targetCurrentRole: data.role })) {
    return jsonError('No puedes eliminar usuarios Admin de plataforma', 403);
  }

  try {
    await adminDeleteUser(id);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error eliminando usuario', 500);
  }
  return new Response(null, { status: 204 });
}

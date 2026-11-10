import { NextRequest } from 'next/server';
import { userToApi, type DbUser } from '@/lib/server/auth';
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
import { isPlatformAdminRole } from '@/types';

type Ctx = { params: Promise<{ id: string }> };

async function getMembershipInOrg(organizationId: string, userId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('memberships')
    .select('id, role, status, user:users(*)')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { error: error.message, membership: null as null };
  return { error: null, membership: data };
}

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
  return 0;
}

function membershipUserToApi(
  user: DbUser,
  membership: { role: string; status: string }
) {
  return userToApi({
    ...user,
    role: membership.role || user.role,
    status: membership.status || user.status,
  });
}

export async function GET(request: NextRequest, context: Ctx) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  const { id } = await context.params;

  const { error, membership } = await getMembershipInOrg(ctx.organizationId, id);
  if (error) return jsonError(error, 500);
  if (!membership?.user || Array.isArray(membership.user)) {
    return jsonError('Usuario no encontrado en esta organización', 404);
  }

  const u = membership.user as unknown as DbUser;
  return jsonOk(membershipUserToApi(u, membership));
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
    return jsonError('Estado no válido. Usa: Activo o Inactivo', 400);
  }

  const { error: memErr, membership } = await getMembershipInOrg(ctx.organizationId, id);
  if (memErr) return jsonError(memErr, 500);
  if (!membership?.user || Array.isArray(membership.user)) {
    return jsonError('Usuario no encontrado en esta organización', 404);
  }

  const profile = membership.user as unknown as DbUser;
  const currentMemberRole = membership.role || profile.role;
  const currentMemberStatus = membership.status || profile.status;
  const nextRole = body.role ?? currentMemberRole;
  const nextStatus = body.status ?? currentMemberStatus;
  const platformAdmin = isPlatformAdminRole(current.role);

  if (
    !canAssignRole(current, nextRole, { targetCurrentRole: currentMemberRole }) ||
    (body.status !== undefined &&
      !canAssignRole(current, currentMemberRole, { targetCurrentRole: currentMemberRole }))
  ) {
    return jsonError('No puedes modificar usuarios Admin de plataforma', 403);
  }

  const wasActiveAdmin = currentMemberRole === 'Admin' && currentMemberStatus === 'Activo';
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

  // Nombre/initials globales: solo Admin de plataforma (evita tocar identidad compartida entre tenants)
  if ((body.name !== undefined || body.initials !== undefined) && !platformAdmin) {
    return jsonError(
      'Solo Admin de plataforma puede cambiar nombre o iniciales globales',
      403,
    );
  }

  const admin = getAdminClient();

  // Membresía del tenant (fuente de verdad de rol/estado en la org)
  const { error: upsertErr } = await admin.from('memberships').upsert(
    {
      user_id: id,
      organization_id: ctx.organizationId,
      role: nextRole,
      status: nextStatus === 'Inactivo' ? 'Inactivo' : 'Activo',
    },
    { onConflict: 'user_id,organization_id' }
  );
  if (upsertErr) return jsonError(upsertErr.message, 500);

  let updatedProfile = profile;

  if (platformAdmin) {
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.initials !== undefined) updates.initials = body.initials;
    // Sync global role/status solo desde plataforma (no desde Manager de un cliente)
    if (body.role !== undefined) updates.role = body.role;
    if (body.status !== undefined) updates.status = body.status;

    if (Object.keys(updates).length) {
      const { data, error } = await admin
        .from('users')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (error || !data) return jsonError(error?.message || 'Error actualizando perfil', 500);
      updatedProfile = data as DbUser;

      if (body.role || body.name || body.initials) {
        await adminUpdateUserMetadata(id, {
          name: updatedProfile.name,
          role: updatedProfile.role,
          initials: updatedProfile.initials || '',
        });
      }
    }
  }

  return jsonOk(
    membershipUserToApi(updatedProfile, {
      role: nextRole,
      status: nextStatus === 'Inactivo' ? 'Inactivo' : 'Activo',
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

  const { error: memErr, membership } = await getMembershipInOrg(ctx.organizationId, id);
  if (memErr) return jsonError(memErr, 500);
  if (!membership) {
    return jsonError('Usuario no encontrado en esta organización', 404);
  }

  const memberRole = membership.role;
  if (!canAssignRole(current, memberRole, { targetCurrentRole: memberRole })) {
    return jsonError('No puedes eliminar usuarios Admin de plataforma', 403);
  }

  const admin = getAdminClient();
  const platformAdmin = isPlatformAdminRole(current.role);

  if (!platformAdmin) {
    // Manager: solo quita del tenant (no borra Auth ni otras orgs)
    const { error } = await admin
      .from('memberships')
      .delete()
      .eq('user_id', id)
      .eq('organization_id', ctx.organizationId);
    if (error) return jsonError(error.message, 500);
    return new Response(null, { status: 204 });
  }

  // Admin de plataforma: eliminación global de identidad Auth (+ cascade memberships)
  if (memberRole === 'Admin') {
    const others = await countActiveAdmins(ctx.organizationId, id);
    if (others < 1) {
      return jsonError('No puedes eliminar al único administrador activo', 400);
    }
  }

  try {
    await adminDeleteUser(id);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error eliminando usuario', 500);
  }
  return new Response(null, { status: 204 });
}

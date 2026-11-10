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
import { adminCreateUser } from '@/lib/supabase/admin-users';

export async function GET(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const admin = getAdminClient();

  // Preferir miembros del tenant
  const { data: memberships, error: memErr } = await admin
    .from('memberships')
    .select('role, status, user:users(*)')
    .eq('organization_id', ctx.organizationId);

  if (!memErr && memberships) {
    let rows = memberships
      .map((m) => {
        const u = m.user as unknown as Parameters<typeof userToApi>[0] | null;
        if (!u || typeof u !== 'object' || Array.isArray(u)) return null;
        return {
          ...u,
          role: (m.role as string) || u.role,
          status: (m.status as string) || u.status,
        };
      })
      .filter(Boolean) as Parameters<typeof userToApi>[0][];

    if (role) rows = rows.filter((u) => u.role === role);
    if (status) rows = rows.filter((u) => u.status === status);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return jsonOk(rows.map((u) => userToApi(u)));
  }

  // Fallback pre-migración
  let query = admin.from('users').select('*').order('name');
  if (role) query = query.eq('role', role);
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return jsonOk((data ?? []).map((u) => userToApi(u as Parameters<typeof userToApi>[0])));
}

export async function POST(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  if (!canManageUsers(ctx.user, ctx.config)) {
    return jsonError('Sin permiso para crear usuarios', 403);
  }

  const body = (await request.json()) as {
    name: string;
    email: string;
    password: string;
    role: string;
    status?: string;
    initials?: string;
  };

  if (!body.name?.trim() || !body.email?.trim() || !body.password) {
    return jsonError('Nombre, email y contraseña son obligatorios', 400);
  }
  if (!isValidUserRole(body.role)) {
    return jsonError(`Rol no válido. Usa: ${USER_ROLES.join(', ')}`, 400);
  }
  if (!canAssignRole(ctx.user, body.role)) {
    return jsonError('No puedes asignar el rol Admin de plataforma', 403);
  }

  const admin = getAdminClient();
  const { data: existing } = await admin.from('users').select('id').eq('email', body.email).maybeSingle();
  if (existing) return jsonError('Email ya registrado', 409);

  const initials =
    body.initials ||
    body.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  try {
    const authUser = await adminCreateUser({
      email: body.email,
      password: body.password,
      name: body.name,
      role: body.role,
      initials,
    });

    let user = null;
    for (let i = 0; i < 5; i++) {
      const { data } = await admin.from('users').select('*').eq('id', authUser.id).maybeSingle();
      if (data) {
        user = data;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!user) {
      return jsonError('Usuario creado en Auth pero perfil no sincronizado', 500);
    }
    if (body.status && body.status !== 'Activo') {
      const { data: updated } = await admin
        .from('users')
        .update({ status: body.status })
        .eq('id', user.id)
        .select('*')
        .single();
      if (updated) user = updated;
    }

    await admin.from('memberships').upsert(
      {
        user_id: user.id,
        organization_id: ctx.organizationId,
        role: body.role,
        status: body.status === 'Inactivo' ? 'Inactivo' : 'Activo',
      },
      { onConflict: 'user_id,organization_id' }
    );

    return jsonOk(userToApi(user as Parameters<typeof userToApi>[0]), { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error creando usuario', 500);
  }
}

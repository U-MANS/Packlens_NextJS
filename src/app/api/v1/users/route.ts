import { NextRequest } from 'next/server';
import { requireUser, userToApi } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { canManageUsers } from '@/lib/server/permissions';
import { getAdminClient } from '@/lib/supabase/admin';
import { adminCreateUser } from '@/lib/supabase/admin-users';

export async function GET(request: NextRequest) {
  const current = await requireUser(request);
  if (current instanceof Response) return current;

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const admin = getAdminClient();
  let query = admin.from('users').select('*').order('name');

  if (role) query = query.eq('role', role);
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  return jsonOk((data ?? []).map((u) => userToApi(u as Parameters<typeof userToApi>[0])));
}

export async function POST(request: NextRequest) {
  const current = await requireUser(request);
  if (current instanceof Response) return current;
  if (!canManageUsers(current)) return jsonError('Solo Admin puede crear usuarios', 403);

  const body = (await request.json()) as {
    name: string;
    email: string;
    password: string;
    role: string;
    status?: string;
    initials?: string;
  };

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
    return jsonOk(userToApi(user as Parameters<typeof userToApi>[0]), { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error creando usuario', 500);
  }
}

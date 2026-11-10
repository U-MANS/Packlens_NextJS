import { NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { getAdminClient } from '@/lib/supabase/admin';
import { signInWithPassword, SupabaseAuthError } from '@/lib/supabase/auth';
import { adminCreateUser } from '@/lib/supabase/admin-users';
import { jsonError, jsonOk } from '@/lib/server/http';

/** Solo roles de negocio. Nunca Admin/Manager (privilegio administrativo). */
const ALLOWED_ROLES = new Set(['Marketing', 'Diseño', 'I+D', 'Comercial']);

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '??';
}

export async function POST(request: NextRequest) {
  // Gate primero: sin leer body. En prod / flag off → 403.
  if (!env.debugSignup()) {
    return jsonError('Registro debug deshabilitado', 403);
  }

  let body: {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    initials?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('JSON inválido', 400);
  }

  if (!body.name || !body.email || !body.password || !body.role) {
    return jsonError('name, email, password y role son obligatorios', 400);
  }
  if (!ALLOWED_ROLES.has(body.role)) {
    return jsonError(`Rol inválido. Usa uno de: ${[...ALLOWED_ROLES].join(', ')}`, 400);
  }

  const admin = getAdminClient();
  const { data: existing } = await admin.from('users').select('id').eq('email', body.email).maybeSingle();
  if (existing) return jsonError('Ya existe un usuario con ese email', 409);

  const initials = (body.initials || initialsFromName(body.name)).toUpperCase();

  try {
    const authUser = await adminCreateUser({
      email: body.email,
      password: body.password,
      name: body.name,
      role: body.role,
      initials,
    });

    // Esperar trigger de perfil
    let profile = null;
    for (let i = 0; i < 5; i++) {
      const { data } = await admin.from('users').select('id, role').eq('id', authUser.id).maybeSingle();
      if (data) {
        profile = data;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!profile) {
      return jsonError(
        'Usuario creado en Auth pero sin perfil. Ejecuta 02_auth_profiles.sql en Supabase.',
        500,
      );
    }

    // Defensa: el trigger no debe elevar a Admin/Manager desde este endpoint
    if (profile.role === 'Admin' || profile.role === 'Manager') {
      return jsonError('Perfil con privilegio no permitido vía registro debug', 500);
    }

    const session = await signInWithPassword(body.email, body.password);
    return jsonOk({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type ?? 'bearer',
    });
  } catch (err) {
    if (err instanceof SupabaseAuthError) return jsonError(err.message, err.status);
    return jsonError(err instanceof Error ? err.message : 'Error en registro', 500);
  }
}

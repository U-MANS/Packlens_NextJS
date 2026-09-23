import { NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { signInWithPassword, SupabaseAuthError } from '@/lib/supabase/auth';
import { jsonError, jsonOk, mapAuthStatus } from '@/lib/server/http';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim();
    const password = body.password;
    if (!email || !password) {
      return jsonError('Email y contraseña son obligatorios', 400);
    }

    const session = await signInWithPassword(email, password);
    const userId = session.user?.id;
    if (userId) {
      const admin = getAdminClient();
      const { data: profile } = await admin.from('users').select('id').eq('id', userId).maybeSingle();
      if (!profile) {
        return jsonError(
          'Usuario autenticado pero sin perfil. Ejecuta 02_auth_profiles.sql en Supabase.',
          401,
        );
      }
    }

    return jsonOk({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type ?? 'bearer',
    });
  } catch (err) {
    if (err instanceof SupabaseAuthError) {
      return jsonError(err.message, mapAuthStatus(err.status));
    }
    const message = err instanceof Error ? err.message : 'Error de autenticación';
    // DNS / red hacia Supabase
    if (message.includes('fetch failed') || message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
      return jsonError(
        'No se puede conectar con Supabase (DNS/red). Comprueba SUPABASE_URL y que el proyecto esté activo.',
        503,
      );
    }
    console.error('[auth/login]', err);
    return jsonError(message, 500);
  }
}

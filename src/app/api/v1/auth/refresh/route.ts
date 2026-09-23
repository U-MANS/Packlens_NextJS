import { NextRequest } from 'next/server';
import { refreshSession, SupabaseAuthError } from '@/lib/supabase/auth';
import { jsonError, jsonOk, mapAuthStatus } from '@/lib/server/http';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { refresh_token?: string };
    if (!body.refresh_token) return jsonError('refresh_token requerido', 400);

    const session = await refreshSession(body.refresh_token);
    return jsonOk({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type ?? 'bearer',
    });
  } catch (err) {
    if (err instanceof SupabaseAuthError) {
      return jsonError(err.message, mapAuthStatus(err.status));
    }
    console.error('[auth/refresh]', err);
    return jsonError('Error al refrescar sesión', 500);
  }
}

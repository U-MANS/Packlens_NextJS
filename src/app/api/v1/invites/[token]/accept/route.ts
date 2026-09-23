import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getAdminClient } from '@/lib/supabase/admin';
import { signInWithPassword } from '@/lib/supabase/auth';
import { adminCreateUser } from '@/lib/supabase/admin-users';

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const { token } = await context.params;
  const body = (await request.json()) as { password?: string; name?: string };
  if (!body.password) return jsonError('password requerido', 400);

  const admin = getAdminClient();
  const { data: invite, error } = await admin
    .from('invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!invite) return jsonError('Invitación no válida', 404);
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return jsonError('Invitación expirada', 410);
  }

  const name = body.name || invite.name || invite.email.split('@')[0];
  const initials = String(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();

  try {
    await adminCreateUser({
      email: invite.email,
      password: body.password,
      name,
      role: invite.role,
      initials,
    });

    await admin
      .from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    const session = await signInWithPassword(invite.email, body.password);
    return jsonOk({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type ?? 'bearer',
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Error aceptando invitación', 500);
  }
}

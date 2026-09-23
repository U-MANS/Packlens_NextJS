import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const { token } = await context.params;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('invitations')
    .select('*, inviter:users!invitations_invited_by_fkey(name)')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError('Invitación no válida', 404);
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return jsonError('Invitación expirada', 410);
  }

  return jsonOk({
    email: data.email,
    role: data.role,
    name: data.name,
    expires_at: data.expires_at,
    inviter_name: data.inviter?.name ?? 'Admin',
  });
}

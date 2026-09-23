import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { canManageUsers } from '@/lib/server/permissions';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!canManageUsers(user)) return jsonError('Solo Admin puede reenviar invitaciones', 403);

  const { id } = await context.params;
  const admin = getAdminClient();
  const token = randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from('invitations')
    .update({
      token,
      status: 'pending',
      expires_at: expires,
    })
    .eq('id', id)
    .select('*, inviter:users!invitations_invited_by_fkey(name)')
    .single();

  if (error || !data) return jsonError(error?.message || 'Invitación no encontrada', 404);

  return jsonOk({
    invitation: {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      status: data.status,
      expires_at: data.expires_at,
      accepted_at: data.accepted_at,
      created_at: data.created_at,
      invited_by_name: data.inviter?.name ?? null,
    },
    email_sent: false,
    email_message_id: null,
    email_error: 'Envío de email no configurado en Next.',
  });
}

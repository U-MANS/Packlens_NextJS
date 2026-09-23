import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { canManageUsers } from '@/lib/server/permissions';
import { getAdminClient } from '@/lib/supabase/admin';

function mapInvitation(
  row: Record<string, unknown> & { inviter?: { name?: string } | null },
) {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    role: row.role,
    status: row.status,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at ?? null,
    created_at: row.created_at,
    invited_by_name: row.inviter?.name ?? null,
  };
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!canManageUsers(user)) return jsonError('Solo Admin puede listar invitaciones', 403);

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('invitations')
    .select('*, inviter:users!invitations_invited_by_fkey(name)')
    .order('created_at', { ascending: false });

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      return jsonOk([]);
    }
    return jsonError(error.message, 500);
  }
  return jsonOk((data ?? []).map((r) => mapInvitation(r)));
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!canManageUsers(user)) return jsonError('Solo Admin puede crear invitaciones', 403);

  const body = (await request.json()) as { email?: string; role?: string; name?: string };
  if (!body.email || !body.role) return jsonError('email y role son obligatorios', 400);

  const admin = getAdminClient();
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('email', body.email)
    .maybeSingle();
  if (existingUser) return jsonError('Ya existe un usuario con ese email', 409);

  const token = randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from('invitations')
    .insert({
      email: body.email,
      name: body.name ?? null,
      role: body.role,
      token,
      status: 'pending',
      invited_by: user.id,
      expires_at: expires,
    })
    .select('*, inviter:users!invitations_invited_by_fkey(name)')
    .single();

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      return jsonError(
        'Tabla invitations no existe. Ejecuta supabase/07_invitations.sql en Supabase.',
        501,
      );
    }
    return jsonError(error.message, 500);
  }

  return jsonOk(
    {
      invitation: mapInvitation(data),
      email_sent: false,
      email_message_id: null,
      email_error: 'Envío de email no configurado en Next (la invitación quedó creada).',
    },
    { status: 201 },
  );
}

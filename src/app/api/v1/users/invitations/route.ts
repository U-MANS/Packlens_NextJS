import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/server/http';
import { invitationEmailResponse, mapInvitation, sendInvitationEmail } from '@/lib/server/invitations';
import { requireOrg } from '@/lib/server/org';
import { canAssignRole, canManageUsers } from '@/lib/server/permissions';
import { getAdminClient } from '@/lib/supabase/admin';

function isMissingInvitationsTable(error: { message?: string; code?: string }) {
  const msg = error.message ?? '';
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes("Could not find the table 'public.invitations'")
  );
}

export async function GET(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  if (!canManageUsers(ctx.user, ctx.config)) {
    return jsonError('Sin permiso para listar invitaciones', 403);
  }

  const admin = getAdminClient();
  let query = admin
    .from('invitations')
    .select('*, inviter:users!invitations_invited_by_fkey(name)')
    .order('created_at', { ascending: false });

  const scoped = await query.eq('organization_id', ctx.organizationId);
  if (!scoped.error) {
    return jsonOk((scoped.data ?? []).map((r) => mapInvitation(r)));
  }
  if (/organization_id/i.test(scoped.error.message)) {
    const { data, error } = await admin
      .from('invitations')
      .select('*, inviter:users!invitations_invited_by_fkey(name)')
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissingInvitationsTable(error)) return jsonOk([]);
      return jsonError(error.message, 500);
    }
    return jsonOk((data ?? []).map((r) => mapInvitation(r)));
  }
  if (isMissingInvitationsTable(scoped.error)) return jsonOk([]);
  return jsonError(scoped.error.message, 500);
}

export async function POST(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;
  const user = ctx.user;
  if (!canManageUsers(user, ctx.config)) {
    return jsonError('Sin permiso para crear invitaciones', 403);
  }

  const body = (await request.json()) as { email?: string; role?: string; name?: string };
  if (!body.email || !body.role) return jsonError('email y role son obligatorios', 400);
  if (!canAssignRole(user, body.role)) {
    return jsonError('No puedes invitar con el rol Admin de plataforma', 403);
  }

  const admin = getAdminClient();
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('email', body.email)
    .maybeSingle();
  if (existingUser) return jsonError('Ya existe un usuario con ese email', 409);

  const token = randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const insertPayload: Record<string, unknown> = {
    email: body.email,
    name: body.name ?? null,
    role: body.role,
    token,
    status: 'pending',
    invited_by: user.id,
    expires_at: expires,
    organization_id: ctx.organizationId,
  };

  let { data, error } = await admin
    .from('invitations')
    .insert(insertPayload)
    .select('*, inviter:users!invitations_invited_by_fkey(name)')
    .single();

  if (error && /organization_id/i.test(error.message)) {
    delete insertPayload.organization_id;
    const retry = await admin
      .from('invitations')
      .insert(insertPayload)
      .select('*, inviter:users!invitations_invited_by_fkey(name)')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (isMissingInvitationsTable(error)) {
      return jsonError(
        'Tabla invitations no existe. Ejecuta supabase/07_invitations.sql en el SQL Editor de Supabase.',
        501,
      );
    }
    return jsonError(error.message, 500);
  }

  const email = await sendInvitationEmail({
    to: body.email,
    token,
    role: body.role,
    name: body.name,
    inviterName: user.name,
  });

  return jsonOk(invitationEmailResponse(data, email), { status: 201 });
}

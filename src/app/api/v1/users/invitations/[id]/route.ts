import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError } from '@/lib/server/http';
import { canManageUsers } from '@/lib/server/permissions';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!canManageUsers(user)) return jsonError('Solo Admin puede revocar invitaciones', 403);

  const { id } = await context.params;
  const admin = getAdminClient();
  const { error } = await admin
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', id);
  if (error) return jsonError(error.message, 500);
  return new Response(null, { status: 204 });
}

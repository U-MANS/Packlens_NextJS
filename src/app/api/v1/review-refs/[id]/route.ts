import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError } from '@/lib/server/http';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const admin = getAdminClient();
  const { data } = await admin.from('review_ref_attachments').select('id').eq('id', id).maybeSingle();
  if (!data) return jsonError('Referencia no encontrada', 404);
  const { error } = await admin.from('review_ref_attachments').delete().eq('id', id);
  if (error) return jsonError(error.message, 500);
  return new Response(null, { status: 204 });
}

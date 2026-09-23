import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const admin = getAdminClient();
  const now = new Date().toISOString();

  const { data: unread, error: listError } = await admin
    .from('notifications')
    .select('id')
    .eq('user_id', user.id)
    .is('read_at', null);

  if (listError) return jsonError(listError.message, 500);

  const ids = (unread ?? []).map((n) => n.id);
  if (ids.length === 0) return jsonOk({ marked: 0 });

  const { error } = await admin.from('notifications').update({ read_at: now }).in('id', ids);
  if (error) return jsonError(error.message, 500);

  return jsonOk({ marked: ids.length });
}

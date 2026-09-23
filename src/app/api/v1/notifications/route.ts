import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const limit = Number(new URL(request.url).searchParams.get('limit') ?? '50');
  const admin = getAdminClient();

  const { data, error } = await admin
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(Number.isFinite(limit) ? limit : 50);

  if (error) return jsonError(error.message, 500);

  const items = (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    project_id: n.project_id,
    read_at: n.read_at,
    created_at: n.created_at,
    is_read: n.read_at != null,
  }));

  const unread_count = items.filter((n) => !n.is_read).length;
  return jsonOk({ items, unread_count });
}

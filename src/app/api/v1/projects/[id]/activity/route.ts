import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const url = new URL(request.url);
  const offset = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number(url.searchParams.get('limit') ?? '50');

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('activity_events')
    .select('*, actor:users!activity_events_actor_id_fkey(name), replies:activity_replies(*, author:users!activity_replies_author_id_fkey(name))')
    .eq('project_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return jsonError(error.message, 500);

  return jsonOk(
    (data ?? []).map((e) => ({
      id: e.id,
      project_id: e.project_id,
      type: e.type,
      text: e.text,
      actor: e.actor?.name ?? null,
      phase_action_id: e.phase_action_id,
      created_at: e.created_at,
      replies: (e.replies ?? []).map((r: Record<string, unknown> & { author?: { name?: string } }) => ({
        id: r.id,
        event_id: r.event_id,
        project_id: r.project_id,
        text: r.text,
        author: r.author?.name ?? null,
        role: r.role ?? null,
        created_at: r.created_at,
      })),
    })),
  );
}

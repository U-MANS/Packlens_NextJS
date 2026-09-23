import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id: eventId } = await context.params;
  const body = (await request.json()) as { text?: string };
  if (!body.text?.trim()) return jsonError('Texto requerido', 400);

  const admin = getAdminClient();
  const { data: event } = await admin
    .from('activity_events')
    .select('id, project_id')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return jsonError('Evento no encontrado', 404);

  const { data, error } = await admin
    .from('activity_replies')
    .insert({
      event_id: eventId,
      project_id: event.project_id,
      text: body.text.trim(),
      author_id: user.id,
      role: user.role,
    })
    .select('*')
    .single();
  if (error || !data) return jsonError(error?.message || 'Error creando respuesta', 500);

  return jsonOk(
    {
      id: data.id,
      event_id: data.event_id,
      project_id: data.project_id,
      text: data.text,
      author: user.name,
      role: user.role,
      created_at: data.created_at,
    },
    { status: 201 },
  );
}

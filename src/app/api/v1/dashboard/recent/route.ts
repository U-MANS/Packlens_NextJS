import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { projectToRead } from '@/lib/server/serializers';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('projects')
    .select('*, owner_user:users!projects_owner_id_fkey(name)')
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return jsonError(error.message, 500);
  return jsonOk((data ?? []).map((row) => projectToRead(row as Parameters<typeof projectToRead>[0])));
}

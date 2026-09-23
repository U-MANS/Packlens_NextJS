import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { projectToRead } from '@/lib/server/serializers';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const admin = getAdminClient();
  const { data: projects, error } = await admin
    .from('projects')
    .select('id, phase, market, product_line, archived, status, target_date')
    .eq('archived', false);

  if (error) return jsonError(error.message, 500);

  const rows = projects ?? [];
  const reviewPhases = new Set([
    'Aprobación Diseño',
    'Validación diseño',
    'Aprobación Legal',
    'Arte final',
    'Aprobación final',
  ]);
  const today = new Date().toISOString().slice(0, 10);

  let approved = 0;
  let in_review = 0;
  let overdue = 0;

  for (const p of rows) {
    if (p.phase === 'Aprobado') approved += 1;
    if (reviewPhases.has(p.phase)) in_review += 1;
    if (p.target_date && p.target_date < today && p.phase !== 'Aprobado') overdue += 1;
  }

  return jsonOk({
    total: rows.length,
    approved,
    in_review,
    overdue,
  });
}

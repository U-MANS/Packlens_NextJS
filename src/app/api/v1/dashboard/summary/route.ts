import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/server/http';
import { requireOrg } from '@/lib/server/org';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const ctx = await requireOrg(request);
  if (ctx instanceof Response) return ctx;

  const admin = getAdminClient();
  let { data: projects, error } = await admin
    .from('projects')
    .select('id, phase, market, product_line, archived, status, target_date')
    .eq('archived', false)
    .eq('organization_id', ctx.organizationId);

  if (error && /organization_id/i.test(error.message)) {
    const fallback = await admin
      .from('projects')
      .select('id, phase, market, product_line, archived, status, target_date')
      .eq('archived', false);
    projects = fallback.data;
    error = fallback.error;
  }

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

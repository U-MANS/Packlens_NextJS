import { NextRequest } from 'next/server';
import { requireUser, userToApi } from '@/lib/server/auth';
import { jsonOk } from '@/lib/server/http';

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return jsonOk(userToApi(user));
}

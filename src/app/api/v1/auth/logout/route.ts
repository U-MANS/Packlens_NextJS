import { NextRequest } from 'next/server';
import { bearerToken } from '@/lib/server/auth';
import { signOut } from '@/lib/supabase/auth';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { refresh_token?: string };
    const access = bearerToken(request);
    if (access && body.refresh_token) {
      await signOut(access, body.refresh_token);
    }
  } catch {
    /* ignore logout errors */
  }
  return new Response(null, { status: 204 });
}

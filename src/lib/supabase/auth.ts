import { env } from '@/lib/env';

export class SupabaseAuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'SupabaseAuthError';
    this.status = status;
  }
}

type TokenPayload = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  user?: { id: string; email?: string };
};

function authHeaders(useServiceRole = false): HeadersInit {
  const key = useServiceRole ? env.supabaseServiceRoleKey() : env.supabaseAnonKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as {
      error_description?: string;
      msg?: string;
      message?: string;
    };
    return body.error_description || body.msg || body.message || fallback;
  } catch {
    return fallback;
  }
}

export async function signInWithPassword(email: string, password: string): Promise<TokenPayload> {
  const res = await fetch(`${env.supabaseUrl()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new SupabaseAuthError(await parseError(res, 'Credenciales inválidas'), res.status);
  }
  return (await res.json()) as TokenPayload;
}

export async function refreshSession(refreshToken: string): Promise<TokenPayload> {
  const res = await fetch(`${env.supabaseUrl()}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    throw new SupabaseAuthError('Refresh token inválido', res.status);
  }
  return (await res.json()) as TokenPayload;
}

export async function signOut(accessToken: string, refreshToken: string): Promise<void> {
  await fetch(`${env.supabaseUrl()}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function getUserFromAccessToken(accessToken: string): Promise<{ id: string; email?: string } | null> {
  const res = await fetch(`${env.supabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: env.supabaseAnonKey(),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id: string; email?: string };
  return data;
}

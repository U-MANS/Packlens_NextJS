import { env } from '@/lib/env';

export async function adminCreateUser(payload: {
  email: string;
  password: string;
  name: string;
  role: string;
  initials?: string;
}): Promise<{ id: string }> {
  const res = await fetch(`${env.supabaseUrl()}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseServiceRoleKey(),
      Authorization: `Bearer ${env.supabaseServiceRoleKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        name: payload.name,
        role: payload.role,
        initials: payload.initials || '',
      },
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
    throw new Error(body.msg || body.message || 'Error al crear usuario');
  }
  const data = (await res.json()) as { id: string };
  return data;
}

export async function adminUpdateUserMetadata(
  userId: string,
  metadata: Record<string, string>,
): Promise<void> {
  const res = await fetch(`${env.supabaseUrl()}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: env.supabaseServiceRoleKey(),
      Authorization: `Bearer ${env.supabaseServiceRoleKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_metadata: metadata }),
  });
  if (!res.ok) throw new Error('Error al actualizar usuario');
}

export async function adminFindUserByEmail(email: string): Promise<{ id: string } | null> {
  const res = await fetch(
    `${env.supabaseUrl()}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: env.supabaseServiceRoleKey(),
        Authorization: `Bearer ${env.supabaseServiceRoleKey()}`,
      },
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { users?: { id: string; email?: string }[]; id?: string };
  if (data.users?.length) {
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    return match ? { id: match.id } : { id: data.users[0].id };
  }
  if (data.id) return { id: data.id };
  return null;
}

export async function adminUpdateAuthUser(
  userId: string,
  payload: { password: string; name: string; role: string; initials?: string },
): Promise<void> {
  const res = await fetch(`${env.supabaseUrl()}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: env.supabaseServiceRoleKey(),
      Authorization: `Bearer ${env.supabaseServiceRoleKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        name: payload.name,
        role: payload.role,
        initials: payload.initials || '',
      },
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
    throw new Error(body.msg || body.message || 'Error al actualizar usuario');
  }
}

export async function adminDeleteUser(userId: string): Promise<void> {
  const res = await fetch(`${env.supabaseUrl()}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      apikey: env.supabaseServiceRoleKey(),
      Authorization: `Bearer ${env.supabaseServiceRoleKey()}`,
    },
  });
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
    throw new Error(body.msg || body.message || 'Error al eliminar usuario');
  }
}

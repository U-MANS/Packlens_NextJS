const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
const AUTH_STORAGE_KEY = 'packlens-auth';

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type AuthTokens = { accessToken: string | null; refreshToken: string | null };

type TokenRefreshHandler = (tokens: { accessToken: string; refreshToken: string }) => void;

let onTokensRefreshed: TokenRefreshHandler | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function setTokenRefreshHandler(handler: TokenRefreshHandler | null) {
  onTokensRefreshed = handler;
}

function readAuthStorage(): AuthTokens {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw) as {
      state?: { accessToken?: string | null; refreshToken?: string | null };
    };
    return {
      accessToken: parsed.state?.accessToken ?? null,
      refreshToken: parsed.state?.refreshToken ?? null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function writeAuthTokens(accessToken: string, refreshToken: string) {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      state?: { accessToken?: string | null; refreshToken?: string | null };
    };
    if (!parsed.state) parsed.state = {};
    parsed.state.accessToken = accessToken;
    parsed.state.refreshToken = refreshToken;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
  onTokensRefreshed?.({ accessToken, refreshToken });
}

function getAccessToken(): string | null {
  return readAuthStorage().accessToken;
}

function shouldAttemptRefresh(path: string, status: number): boolean {
  if (status !== 401) return false;
  return !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh') && !path.startsWith('/auth/debug/register') && !path.startsWith('/invites/');
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken } = readAuthStorage();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return false;

      const data = (await res.json()) as {
        access_token: string;
        refresh_token: string;
      };
      writeAuthTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    if (!retried && shouldAttemptRefresh(path, res.status)) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiFetch<T>(path, options, true);
      }
    }

    const detail =
      typeof data === 'object' && data && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : `Error ${res.status}`;
    throw new ApiError(detail, res.status, data);
  }

  return data as T;
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export { API_BASE };

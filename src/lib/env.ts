function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Falta variable de entorno: ${name}`);
  }
  return value;
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return undefined;
}

/**
 * Headers para llamar a la API de Supabase con publishable/secret (o legacy JWT).
 * Las keys nuevas (`sb_publishable_` / `sb_secret_`) NO son JWTs: van en `apikey`.
 * Solo las legacy (`eyJ…`) se envían también como `Authorization: Bearer`.
 */
export function supabaseApiKeyHeaders(
  key: string,
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    'Content-Type': 'application/json',
    ...extra,
  };
  if (key.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

export const env = {
  supabaseUrl: () =>
    required('SUPABASE_URL', process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL),

  /**
   * Publishable key (`sb_publishable_…`) o legacy anon JWT.
   * Preferencia: SUPABASE_PUBLISHABLE_KEY → NEXT_PUBLIC_… → ANON legacy.
   */
  supabasePublishableKey: () =>
    required(
      'SUPABASE_PUBLISHABLE_KEY (o ANON legacy)',
      firstDefined(
        process.env.SUPABASE_PUBLISHABLE_KEY,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        process.env.SUPABASE_ANON_KEY,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
    ),

  /**
   * Secret key (`sb_secret_…`) o legacy service_role JWT.
   * Solo servidor. Preferencia: SUPABASE_SECRET_KEY → SERVICE_ROLE legacy.
   */
  supabaseSecretKey: () =>
    required(
      'SUPABASE_SECRET_KEY (o SERVICE_ROLE legacy)',
      firstDefined(process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY),
    ),

  /** @deprecated Usa supabasePublishableKey */
  supabaseAnonKey: () => env.supabasePublishableKey(),
  /** @deprecated Usa supabaseSecretKey */
  supabaseServiceRoleKey: () => env.supabaseSecretKey(),

  storageBucket: () => process.env.SUPABASE_STORAGE_BUCKET ?? 'packlens-files',
  /**
   * Alta pública de debug. Nunca en production.
   * Requiere DEBUG_ENABLE_SIGNUP=true explícito y NODE_ENV !== 'production'.
   */
  debugSignup: () =>
    process.env.NODE_ENV !== 'production' && process.env.DEBUG_ENABLE_SIGNUP === 'true',
  openaiApiKey: () => process.env.OPENAI_API_KEY || '',
  frontendBaseUrl: () => (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  brevoApiKey: () => process.env.BREVO_API_KEY?.trim() || '',
  brevoSenderEmail: () => process.env.BREVO_SENDER_EMAIL?.trim() || 'cristian@weworkfactory.com',
  brevoSenderName: () => process.env.BREVO_SENDER_NAME?.trim() || 'PackLens',
};

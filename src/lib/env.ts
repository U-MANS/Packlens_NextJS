function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Falta variable de entorno: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: () =>
    required('SUPABASE_URL', process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required(
      'SUPABASE_ANON_KEY',
      process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  supabaseServiceRoleKey: () =>
    required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  storageBucket: () => process.env.SUPABASE_STORAGE_BUCKET ?? 'packlens-files',
  debugSignup: () => process.env.DEBUG_ENABLE_SIGNUP === 'true',
  openaiApiKey: () => process.env.OPENAI_API_KEY || '',
  frontendBaseUrl: () => (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  brevoApiKey: () => process.env.BREVO_API_KEY?.trim() || '',
  brevoSenderEmail: () => process.env.BREVO_SENDER_EMAIL?.trim() || 'cristian@weworkfactory.com',
  brevoSenderName: () => process.env.BREVO_SENDER_NAME?.trim() || 'PackLens',
};

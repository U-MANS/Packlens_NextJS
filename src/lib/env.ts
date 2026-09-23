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
};

// Production environment. These values are PUBLIC (the anon key is the JWT
// public key used for unauthenticated requests; RLS still enforces auth).
// Secret values (service role key, OpenAI key) live only on the Vercel server.
export const environment = {
  production: true,
  supabaseUrl: 'https://your-project-ref.supabase.co',
  supabaseAnonKey: 'replace-with-your-anon-key',
  // Same-origin in production - Vercel hosts /api alongside the SPA.
  apiBaseUrl: '',
  // Optional Sentry/observability hooks. Leave blank to disable.
  sentryDsn: '',
  environmentName: 'production',
  vapidPublicKey: '',
};

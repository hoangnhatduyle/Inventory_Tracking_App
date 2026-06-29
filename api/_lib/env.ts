// Server-only environment access. Throws on first import if a required
// variable is missing so misconfigured deployments fail fast at cold-start
// instead of returning 500s mid-request.

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

function optionalInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseAnonKey: required('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  openaiApiKey: required('OPENAI_API_KEY'),
  openaiModel: optional('OPENAI_MODEL', 'gpt-5-mini'),
  quotaExpiration: optionalInt('AI_QUOTA_EXPIRATION_PER_MONTH', 1000),
  quotaReceipt: optionalInt('AI_QUOTA_RECEIPT_PER_MONTH', 100),
  allowedOrigins: optional('API_ALLOWED_ORIGINS', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  vapidPublicKey: optional('VAPID_PUBLIC_KEY', ''),
  vapidPrivateKey: optional('VAPID_PRIVATE_KEY', ''),
  vapidSubject: optional('VAPID_SUBJECT', 'mailto:admin@example.com'),
  cronSecret: optional('CRON_SECRET', ''),
};

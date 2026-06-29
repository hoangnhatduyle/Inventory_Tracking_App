import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { env } from './env.js';
import { ApiError } from './errors.js';

// Per-request Supabase client bound to the caller's JWT. RLS policies run
// under auth.uid() so the API cannot accidentally cross user boundaries even
// if a query forgets a `.eq('user_id', userId)` filter.

export interface AuthContext {
  user: User;
  client: SupabaseClient;
  jwt: string;
}

export async function requireAuth(req: VercelRequest): Promise<AuthContext> {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) {
    throw new ApiError('UNAUTHORIZED', 'Missing bearer token');
  }
  const jwt = match[1];

  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.auth.getUser(jwt);
  if (error || !data.user) {
    throw new ApiError('UNAUTHORIZED', 'Invalid or expired session');
  }

  return { user: data.user, client, jwt };
}

// Service-role client. Use only for operations that legitimately need to
// bypass RLS (e.g. cross-user aggregations, scheduled cleanup jobs). Never
// expose this client to user input without re-checking authorization first.
let _serviceClient: SupabaseClient | null = null;
export function serviceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _serviceClient;
}

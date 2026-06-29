import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

// One Supabase client per browser tab. Used for auth flows only - data access
// goes through ApiClient -> Vercel /api so RLS + server-side validation are
// always applied.
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'inventory.auth',
      },
    });
  }
  return _client;
}

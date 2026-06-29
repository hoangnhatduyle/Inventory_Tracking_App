// User model. `id` is the Supabase Auth user UUID.
export interface User {
  id: string;
  username: string;
  email?: string;
  createdAt?: string;
}

// Session metadata kept for components that read it. The actual session is
// managed by @supabase/supabase-js inside SupabaseAuthService.
export interface Session {
  userId: string;
  token: string;
  expiresAt: string;
}

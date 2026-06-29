import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from './supabase.client';

export interface AuthResult {
  success: boolean;
  message?: string;
  needsConfirmation?: boolean;
}

// Thin Angular-friendly wrapper over @supabase/supabase-js auth. The rest of
// the app should depend on AuthService (the facade in services/auth.service.ts)
// rather than on this directly, so the rest of the codebase doesn't need to
// know about Supabase concepts.
@Injectable({ providedIn: 'root' })
export class SupabaseAuthService {
  private readonly _session$ = new BehaviorSubject<Session | null>(null);
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);

  constructor() {
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data }) => this.setSession(data.session));
    supabase.auth.onAuthStateChange((_event, session) => this.setSession(session));
  }

  get session$(): Observable<Session | null> {
    return this._session$.asObservable();
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    this.setSession(data.session);
    return { success: true };
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await getSupabase().auth.signUp({ email, password });
    if (error) return { success: false, message: error.message };
    // If email confirmation is required Supabase returns a session = null.
    if (!data.session) {
      return { success: true, needsConfirmation: true };
    }
    this.setSession(data.session);
    return { success: true };
  }

  async signOut(): Promise<void> {
    await getSupabase().auth.signOut();
    this.setSession(null);
  }

  async requestPasswordReset(email: string): Promise<AuthResult> {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    return error ? { success: false, message: error.message } : { success: true };
  }

  async updatePassword(newPassword: string): Promise<AuthResult> {
    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    return error ? { success: false, message: error.message } : { success: true };
  }

  async getAccessToken(): Promise<string | null> {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  }

  private setSession(session: Session | null): void {
    this._session$.next(session);
    this.session.set(session);
    this.user.set(session?.user ?? null);
  }
}

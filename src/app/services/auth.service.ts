import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';
import { SupabaseAuthService } from '../core/supabase-auth.service';
import { User } from '../models/user.model';

// Backwards-compatible facade over SupabaseAuthService. Components keep using
// `authService.login(email, password)`, `getCurrentUser()`, `getCurrentUserId()`
// etc. exactly as before. The legacy `register(username, ...)` signature now
// requires `username` to be an email address (Supabase Auth is email-based).
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseAuthService);
  private readonly router = inject(Router);

  private readonly authStateSubject = new BehaviorSubject<boolean>(false);
  public readonly authState$: Observable<boolean> = this.authStateSubject.asObservable();

  private currentUser: User | null = null;

  constructor() {
    this.supabase.session$.subscribe((session) => {
      if (session?.user) {
        this.currentUser = {
          id: session.user.id,
          username: session.user.email ?? '',
          email: session.user.email ?? undefined,
          createdAt: session.user.created_at,
        };
        this.authStateSubject.next(true);
      } else {
        this.currentUser = null;
        this.authStateSubject.next(false);
      }
    });
  }

  async register(
    email: string,
    password: string,
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.supabase.signUp(email, password);
    if (!result.success) {
      return { success: false, message: result.message ?? 'Registration failed' };
    }
    return {
      success: true,
      message: result.needsConfirmation
        ? 'Check your email to confirm your account before logging in.'
        : 'Registration successful',
    };
  }

  async login(email: string, password: string): Promise<{ success: boolean; message: string }> {
    const result = await this.supabase.signIn(email, password);
    return result.success
      ? { success: true, message: 'Login successful' }
      : { success: false, message: result.message ?? 'Invalid email or password' };
  }

  async logout(): Promise<void> {
    await this.supabase.signOut();
    this.currentUser = null;
    this.authStateSubject.next(false);
    void this.router.navigate(['/login']);
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.supabase.getAccessToken();
    const ok = !!token;
    this.authStateSubject.next(ok);
    return ok;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  // Supabase user ids are UUID strings. The server is the authority on the
  // user identity (auth.uid()) - the value returned here is for UI display
  // and best-effort client-side scoping only.
  async getCurrentUserId(): Promise<string | null> {
    return this.currentUser?.id ?? null;
  }

  // Legacy alias kept while components migrate from the SQLite-era helper.
  async getUserId(): Promise<string | null> {
    return this.getCurrentUserId();
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const r = await this.supabase.requestPasswordReset(email);
    return r.success
      ? { success: true, message: 'Password reset email sent' }
      : { success: false, message: r.message ?? 'Failed to send reset email' };
  }
}

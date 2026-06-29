import { inject } from '@angular/core';
import { HttpHandlerFn, HttpRequest, HttpEvent } from '@angular/common/http';
import { Router } from '@angular/router';
import { from, Observable, switchMap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SupabaseAuthService } from './supabase-auth.service';

// Functional interceptor: attaches the Supabase JWT to every same-origin /api
// request and routes any 401 back to /login with a one-shot reason flag.

function isApiRequest(url: string): boolean {
  if (url.startsWith('/api/')) return true;
  if (!environment.apiBaseUrl) return false;
  return url.startsWith(`${environment.apiBaseUrl}/api/`);
}

export function authInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const auth = inject(SupabaseAuthService);
  const router = inject(Router);

  return from(auth.getAccessToken()).pipe(
    switchMap((token) => {
      const withAuth = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;
      return next(withAuth).pipe(
        catchError((err) => {
          if (err?.status === 401) {
            void auth.signOut().finally(() =>
              router.navigate(['/login'], { queryParams: { reason: 'session-expired' } }),
            );
          }
          return throwError(() => err);
        }),
      );
    }),
  );
}

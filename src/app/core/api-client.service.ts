import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SupabaseAuthService } from './supabase-auth.service';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

type QueryParams = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  query?: QueryParams;
  signal?: AbortSignal;
}

// Centralised HTTP client for the Vercel /api/* endpoints. Injects the
// Supabase JWT into Authorization on every request and normalises the
// `{data}` / `{error}` envelope into either the payload (success) or a
// thrown `ApiClientError` (failure).
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(SupabaseAuthService);

  private url(path: string): string {
    const base = environment.apiBaseUrl ?? '';
    const normalisedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const normalisedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalisedBase}${normalisedPath}`;
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await this.auth.getAccessToken();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  private params(query?: QueryParams): HttpParams | undefined {
    if (!query) return undefined;
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      params = params.set(k, String(v));
    }
    return params;
  }

  async get<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, opts);
  }

  async post<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, body, opts);
  }

  async patch<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', path, body, opts);
  }

  async delete<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, undefined, opts);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
    opts: RequestOptions,
  ): Promise<T> {
    const headers = await this.headers();
    const params = this.params(opts.query);

    try {
      const response = await firstValueFrom(
        this.http.request<{ data: T }>(method, this.url(path), {
          headers,
          body,
          params,
          observe: 'body',
          responseType: 'json',
        }),
      );
      return (response?.data ?? null) as T;
    } catch (err) {
      throw this.normalise(err);
    }
  }

  private normalise(err: unknown): ApiClientError {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { error?: ApiErrorBody } | null;
      const apiError: ApiErrorBody = body?.error ?? {
        code: 'NETWORK',
        message: err.message || 'Network error',
      };
      return new ApiClientError(err.status, apiError);
    }
    return new ApiClientError(0, {
      code: 'UNKNOWN',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

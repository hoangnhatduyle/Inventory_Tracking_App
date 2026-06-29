import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { ApiClient, ApiClientError } from './api-client.service';
import { SupabaseAuthService } from './supabase-auth.service';

class MockSupabaseAuthService {
  async getAccessToken(): Promise<string | null> {
    return 'test-jwt';
  }
}

class MockRouter {
  navigate = jasmine.createSpy('navigate').and.resolveTo(true);
}

const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const urlEndsWith = (suffix: string) => (req: { url: string }) => req.url.endsWith(suffix);

describe('ApiClient', () => {
  let api: ApiClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiClient,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SupabaseAuthService, useClass: MockSupabaseAuthService },
        { provide: Router, useClass: MockRouter },
      ],
    });
    api = TestBed.inject(ApiClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('unwraps a { data } envelope and returns the payload', async () => {
    const pending = api.get<{ id: number }>('/api/inventory/1');
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/inventory/1'));
    expect(req.request.method).toBe('GET');
    req.flush({ data: { id: 1 } });
    await expectAsync(pending).toBeResolvedTo({ id: 1 });
  });

  it('sets the Authorization header from the auth service', async () => {
    const pending = api.get('/api/inventory');
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/inventory'));
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');
    req.flush({ data: [] });
    await expectAsync(pending).toBeResolved();
  });

  it('throws ApiClientError for { error } responses', async () => {
    const pending = api.post('/api/inventory', { name: 'x' });
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/inventory'));
    expect(req.request.method).toBe('POST');
    req.flush(
      { error: { code: 'VALIDATION_FAILED', message: 'bad payload' } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    let caught: unknown = null;
    try {
      await pending;
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeTruthy();
    expect(caught instanceof ApiClientError).toBeTrue();
    const err = caught as ApiClientError;
    expect(err.status).toBe(422);
    expect((err.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });
});

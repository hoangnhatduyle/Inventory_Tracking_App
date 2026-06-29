import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { ExpirationAIService } from './expiration-ai.service';
import { ApiClient } from '../core/api-client.service';
import { SupabaseAuthService } from '../core/supabase-auth.service';

class MockSupabaseAuthService {
  async getAccessToken(): Promise<string | null> {
    return 'test-jwt';
  }
}

class MockRouter {
  navigate = jasmine.createSpy('navigate').and.resolveTo(true);
}

// ApiClient awaits getAccessToken() before sending the HTTP request, so we
// need to flush a few microtasks before HttpTestingController.expectOne sees
// the pending request.
const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

// ApiClient prefixes every request with environment.apiBaseUrl (e.g.
// http://localhost:3000). Use suffix-matching so tests stay portable.
const urlEndsWith = (suffix: string) => (req: { url: string }) => req.url.endsWith(suffix);

describe('ExpirationAIService', () => {
  let service: ExpirationAIService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiClient,
        ExpirationAIService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SupabaseAuthService, useClass: MockSupabaseAuthService },
        { provide: Router, useClass: MockRouter },
      ],
    });
    service = TestBed.inject(ExpirationAIService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs the AISuggestionRequest object to /api/ai/expiration-suggest', async () => {
    const pending = service.suggestExpiration({
      itemName: 'Yogurt',
      categoryName: 'Dairy',
      storageLocation: 'Fridge',
      purchaseDate: '2026-06-01',
    });
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/ai/expiration-suggest'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      itemName: 'Yogurt',
      categoryName: 'Dairy',
      storageLocation: 'Fridge',
      purchaseDate: '2026-06-01',
    });
    req.flush({ data: { days: 14, note: 'fridge dairy' } });
    const out = await pending;
    expect(out.days).toBe(14);
    expect(out.note).toBe('fridge dairy');
  });

  it('translates 429 quota errors into a user-friendly message', async () => {
    const pending = service.suggestExpiration({ itemName: 'Milk' });
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/ai/expiration-suggest'));
    req.flush(
      { error: { code: 'QUOTA_EXCEEDED', message: 'no quota' } },
      { status: 429, statusText: 'Too Many Requests' },
    );
    let caught: Error | null = null;
    try {
      await pending;
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeTruthy();
    expect(caught!.message.toLowerCase()).toContain('limit');
  });

  it('translates 500 errors into a generic unavailable message', async () => {
    const pending = service.suggestExpiration({ itemName: 'Milk' });
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/ai/expiration-suggest'));
    req.flush(
      { error: { code: 'OPENAI_FAILED', message: 'boom' } },
      { status: 500, statusText: 'Server Error' },
    );
    let caught: Error | null = null;
    try {
      await pending;
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeTruthy();
    expect(caught!.message.toLowerCase()).toContain('unavailable');
  });
});

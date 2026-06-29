import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { ReceiptScanService } from './receipt-scan.service';
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

const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const urlEndsWith = (suffix: string) => (req: { url: string }) => req.url.endsWith(suffix);

describe('ReceiptScanService', () => {
  let service: ReceiptScanService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiClient,
        ReceiptScanService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SupabaseAuthService, useClass: MockSupabaseAuthService },
        { provide: Router, useClass: MockRouter },
      ],
    });
    service = TestBed.inject(ReceiptScanService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('posts the storage path (not the image bytes) to /api/ai/receipt-scan', async () => {
    const storagePath = 'user-123/receipts/abc.jpg';
    const pending = service.parseReceipt(storagePath);
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/ai/receipt-scan'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ imagePath: storagePath });
    req.flush({ data: { items: [{ name: 'Milk', quantity: 1 }] } });
    const result = await pending;
    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe('Milk');
  });

  it('exposes Array methods on the result (legacy compatibility)', async () => {
    const pending = service.parseReceipt('user-123/receipts/a.jpg');
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/ai/receipt-scan'));
    req.flush({
      data: {
        items: [
          { name: 'A', quantity: 1 },
          { name: 'B', quantity: 2 },
        ],
      },
    });
    const result = await pending;
    expect(Array.isArray(result)).toBeTrue();
    expect(result.length).toBe(2);
    expect(result.map((i) => i.name)).toEqual(['A', 'B']);
  });

  it('returns a 429-friendly error when the quota is exhausted', async () => {
    const pending = service.parseReceipt('user-123/receipts/a.jpg');
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/ai/receipt-scan'));
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

  describe('getDefaultExpiryDays', () => {
    it('returns conservative defaults per category', () => {
      expect(service.getDefaultExpiryDays('dairy')).toBe(14);
      expect(service.getDefaultExpiryDays('produce')).toBe(7);
      expect(service.getDefaultExpiryDays('Meat')).toBe(3);
    });
    it('falls back to "other" when the hint is unknown or missing', () => {
      expect(service.getDefaultExpiryDays(undefined)).toBe(30);
      expect(service.getDefaultExpiryDays('totally-made-up')).toBe(30);
    });
  });
});

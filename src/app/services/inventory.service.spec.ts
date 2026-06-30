import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { InventoryService } from './inventory.service';
import { ApiClient } from '../core/api-client.service';
import { SupabaseAuthService } from '../core/supabase-auth.service';
import { InventoryItem } from '../models/inventory.model';

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

const sampleItem = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 1,
  userId: 'user-uuid',
  name: 'Milk',
  quantity: 1,
  unit: 'l',
  categoryId: 1,
  locationId: 1,
  purchaseDate: '2026-06-01',
  expirationDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
  notificationEnabled: true,
  notificationDaysBefore: 3,
  ...overrides,
});

describe('InventoryService', () => {
  let service: InventoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiClient,
        InventoryService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SupabaseAuthService, useClass: MockSupabaseAuthService },
        { provide: Router, useClass: MockRouter },
      ],
    });
    service = TestBed.inject(InventoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('does NOT pass a userId query param to /api/inventory (server resolves it from the JWT)', async () => {
    const pending = service.getItems();
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/inventory'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ data: [] });
    await pending;
  });

  it('returns server item list as-is', async () => {
    const pending = service.getItems();
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/inventory'));
    req.flush({ data: [sampleItem(), sampleItem({ id: 2, name: 'Eggs' })] });
    const items = await pending;
    expect(items.length).toBe(2);
    expect(items[1].name).toBe('Eggs');
  });

  it('filterItems applies category/location/expiringInDays predicates locally', async () => {
    const futureExp = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const farExp = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const items: InventoryItem[] = [
      sampleItem({ id: 1, categoryId: 1, locationId: 1, expirationDate: futureExp }),
      sampleItem({ id: 2, categoryId: 2, locationId: 1, expirationDate: futureExp }),
      sampleItem({ id: 3, categoryId: 1, locationId: 2, expirationDate: farExp }),
    ];
    const pending = service.filterItems(1, 1, 7);
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/inventory'));
    req.flush({ data: items });
    const filtered = await pending;
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(1);
  });

  it('markAsWasted POSTs to /api/waste/from-item (atomic on the server)', async () => {
    const pending = service.markAsWasted(42);
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/waste/from-item'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ itemId: 42 });
    req.flush({ data: { ok: true } });
    expect(await pending).toBeTrue();
  });

  it('getLowStockItems returns only items below their lowStockThreshold', async () => {
    const items: InventoryItem[] = [
      sampleItem({ id: 1, initialQuantity: 100, currentQuantity: 0.2, lowStockThreshold: 1 }),
      sampleItem({ id: 2, initialQuantity: 100, currentQuantity: 5, lowStockThreshold: 1 }),
      sampleItem({ id: 3, initialQuantity: 100, currentQuantity: undefined, lowStockThreshold: 1 }),
    ];
    const pending = service.getLowStockItems();
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/inventory'));
    req.flush({ data: items });
    const low = await pending;
    expect(low.map((i) => i.id)).toEqual([1]);
  });

  it('getImagesByBarcode encodes the barcode and returns [] on error', async () => {
    const weird = 'abc/def 123';
    const pending = service.getImagesByBarcode(weird);
    await flushMicrotasks();
    const req = httpMock.expectOne(
      urlEndsWith(`/api/inventory/by-barcode/${encodeURIComponent(weird)}/images`),
    );
    req.flush({ error: { code: 'NOT_FOUND', message: 'no images' } }, { status: 404, statusText: 'Not Found' });
    const result = await pending;
    expect(result).toEqual([]);
  });
});

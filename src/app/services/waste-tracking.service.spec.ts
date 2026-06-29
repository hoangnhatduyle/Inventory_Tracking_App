import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { WasteTrackingService } from './waste-tracking.service';
import { ApiClient } from '../core/api-client.service';
import { SupabaseAuthService } from '../core/supabase-auth.service';
import { WastedItem } from '../models/waste-tracking.model';

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

describe('WasteTrackingService', () => {
  let service: WasteTrackingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiClient,
        WasteTrackingService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SupabaseAuthService, useClass: MockSupabaseAuthService },
        { provide: Router, useClass: MockRouter },
      ],
    });
    service = TestBed.inject(WasteTrackingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getWasteLog hits /api/waste without a userId param', async () => {
    const pending = service.getWasteLog();
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/waste'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ data: [] });
    await pending;
  });

  it('aggregates wasted items by category and month with total value', async () => {
    const log: WastedItem[] = [
      {
        id: 1,
        itemName: 'Milk',
        categoryId: 1,
        categoryName: 'Dairy',
        quantity: 1,
        unit: 'l',
        price: 3,
        wastedDate: '2026-06-01',
      },
      {
        id: 2,
        itemName: 'Yogurt',
        categoryId: 1,
        categoryName: 'Dairy',
        quantity: 2,
        unit: 'cup',
        price: 1.5,
        wastedDate: '2026-06-15',
      },
      {
        id: 3,
        itemName: 'Lettuce',
        categoryId: 2,
        categoryName: 'Produce',
        quantity: 1,
        unit: 'head',
        price: 2,
        wastedDate: '2026-05-10',
      },
    ];
    const pending = service.getWasteStatistics();
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/waste'));
    req.flush({ data: log });
    const stats = await pending;
    expect(stats.totalItemsWasted).toBe(3);
    // 3*1 + 1.5*2 + 2*1 = 8
    expect(stats.totalValueLost).toBe(8);

    const dairy = stats.wasteByCategory.find((c) => c.categoryName === 'Dairy');
    expect(dairy).toBeTruthy();
    expect(dairy!.itemsWasted).toBe(2);
    expect(dairy!.valueLost).toBe(6);

    const months = stats.wasteByMonth.map((m) => m.month);
    expect(months).toContain('2026-06');
    expect(months).toContain('2026-05');
  });

  it('handles items with missing price/quantity gracefully (no NaN)', async () => {
    const log: WastedItem[] = [
      {
        itemName: 'Unknown',
        quantity: 1,
        unit: '',
        wastedDate: '2026-06-01',
      },
    ];
    const pending = service.getWasteStatistics();
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/waste'));
    req.flush({ data: log });
    const stats = await pending;
    expect(stats.totalValueLost).toBe(0);
    expect(stats.wasteByCategory[0].categoryName).toBe('Unknown');
  });
});

import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { StatisticsService } from './statistics.service';
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

describe('StatisticsService', () => {
  let service: StatisticsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiClient,
        StatisticsService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SupabaseAuthService, useClass: MockSupabaseAuthService },
        { provide: Router, useClass: MockRouter },
      ],
    });
    service = TestBed.inject(StatisticsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('hydrates the dashboard payload from /api/statistics/dashboard with all fields present', async () => {
    const pending = service.getDashboardStatistics();
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/statistics/dashboard'));
    expect(req.request.method).toBe('GET');
    req.flush({
      data: {
        totalItems: 12,
        totalValue: '42.50',
        expiringCount: 3,
        expiredCount: 1,
        expiringSoon: [{ id: 1, name: 'Milk' }],
        lowStock: [{ id: 2, name: 'Bread' }],
        byCategory: [{ category: 'Dairy', count: 4 }],
        byLocation: [{ location: 'Fridge', count: 5 }],
        waste30dCount: 2,
        waste30dValue: '7.25',
        mostWastedItems: [{ itemName: 'Lettuce', count: 3, totalValue: 5 }],
      },
    });
    const stats = await pending;
    expect(stats.totalItems).toBe(12);
    expect(stats.totalValue).toBe(42.5);
    expect(stats.expiringCount).toBe(3);
    expect(stats.expiredCount).toBe(1);
    expect((stats.expiringSoon as InventoryItem[])[0].name).toBe('Milk');
    expect(stats.categoryBreakdown[0].categoryName).toBe('Dairy');
    expect(stats.locationBreakdown[0].locationName).toBe('Fridge');
    expect(stats.waste30dCount).toBe(2);
    expect(stats.waste30dValue).toBe(7.25);
    expect(stats.totalWastedValue).toBe(7.25);
  });

  it('returns a fully-populated zero-state when the server returns an empty payload', async () => {
    const pending = service.getDashboardStatistics();
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/statistics/dashboard'));
    req.flush({ data: {} });
    const stats = await pending;
    expect(stats.totalItems).toBe(0);
    expect(stats.totalValue).toBe(0);
    expect(stats.expiringSoon).toEqual([]);
    expect(stats.lowStock).toEqual([]);
    expect(stats.categoryBreakdown).toEqual([]);
    expect(stats.locationBreakdown).toEqual([]);
    expect(stats.wastedItems).toEqual([]);
    expect(stats.waste30dCount).toBe(0);
    expect(stats.waste30dValue).toBe(0);
  });

  it('buildInventoryCsv escapes formula-injection prefixes', () => {
    const items = [
      {
        id: 1,
        userId: 'u',
        name: '=cmd',
        quantity: 1,
        unit: '',
        categoryId: 1,
        locationId: 1,
        expirationDate: '2026-06-01',
        notes: 'safe',
      } as unknown as InventoryItem,
    ];
    const csv = service.buildInventoryCsv(items);
    expect(csv).toContain('"\'=cmd"');
  });

  it('getRecipeSuggestions returns an empty array (v1 stub) without touching the network', async () => {
    const out = await service.getRecipeSuggestions();
    expect(out).toEqual([]);
    httpMock.expectNone(() => true);
  });
});

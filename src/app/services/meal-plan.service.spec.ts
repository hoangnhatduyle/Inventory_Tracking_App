import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { MealPlanService } from './meal-plan.service';
import { ApiClient } from '../core/api-client.service';
import { SupabaseAuthService } from '../core/supabase-auth.service';
import { MealPlan } from '../models/meal-plan.model';

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

const plan = (overrides: Partial<MealPlan> = {}): MealPlan => ({
  id: 1,
  userId: 'user-uuid',
  planDate: '2026-06-01',
  mealType: 'breakfast',
  mealName: 'Oatmeal',
  isFavorite: false,
  ...overrides,
});

describe('MealPlanService', () => {
  let service: MealPlanService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiClient,
        MealPlanService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SupabaseAuthService, useClass: MockSupabaseAuthService },
        { provide: Router, useClass: MockRouter },
      ],
    });
    service = TestBed.inject(MealPlanService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getMealPlansInRange passes from/to as query params, no userId', async () => {
    const pending = service.getMealPlansInRange('2026-06-01', '2026-06-07');
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/meal-plans'));
    expect(req.request.params.get('from')).toBe('2026-06-01');
    expect(req.request.params.get('to')).toBe('2026-06-07');
    expect(req.request.params.get('userId')).toBeNull();
    req.flush({ data: [] });
    await pending;
  });

  it('getSummary aggregates counts, favorites, most-frequent meals', async () => {
    const pending = service.getSummary('2026-06-01', '2026-06-03');
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/meal-plans'));
    req.flush({
      data: [
        plan({ id: 1, planDate: '2026-06-01', mealType: 'breakfast', mealName: 'Oatmeal', isFavorite: true }),
        plan({ id: 2, planDate: '2026-06-01', mealType: 'lunch', mealName: 'Salad' }),
        plan({ id: 3, planDate: '2026-06-02', mealType: 'breakfast', mealName: 'Oatmeal' }),
      ],
    });
    const summary = await pending;
    expect(summary.totalMeals).toBe(3);
    expect(summary.byMealType.breakfast).toBe(2);
    expect(summary.byMealType.lunch).toBe(1);
    expect(summary.byMealType.dinner).toBe(0);
    expect(summary.favoriteMeals.length).toBe(1);
    expect(summary.mostFrequentMeals[0]).toEqual(
      jasmine.objectContaining({ mealName: 'Oatmeal', count: 2 }),
    );
    expect(summary.totalSlots).toBe(9);
    expect(summary.filledSlots).toBe(3);
    expect(summary.emptySlots).toBe(6);
  });

  it('toggleFavorite PATCHes the plan with flipped isFavorite', async () => {
    const original = plan({ id: 7, isFavorite: false });
    const pending = service.toggleFavorite(original);
    await flushMicrotasks();
    const req = httpMock.expectOne(urlEndsWith('/api/meal-plans/7'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.isFavorite).toBeTrue();
    req.flush({ data: { ...original, isFavorite: true } });
    expect(await pending).toBeTrue();
  });

  it('toggleFavorite returns false when the plan has no id', async () => {
    const result = await service.toggleFavorite(plan({ id: undefined }));
    httpMock.expectNone(() => true);
    expect(result).toBeFalse();
  });
});

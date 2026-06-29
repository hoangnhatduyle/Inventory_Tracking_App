import { inject, Injectable } from '@angular/core';
import { ApiClient, ApiClientError } from '../core/api-client.service';
import { MealPlan, MealPlanSummary, MealType } from '../models/meal-plan.model';

export type { MealPlan, MealPlanSummary, MealType };

@Injectable({ providedIn: 'root' })
export class MealPlanService {
  private readonly api = inject(ApiClient);

  async getMealPlansInRange(from: string, to: string): Promise<MealPlan[]> {
    return this.api.get<MealPlan[]>('/api/meal-plans', { query: { from, to } });
  }

  async addMealPlan(plan: MealPlan): Promise<number> {
    try {
      const saved = await this.api.post<MealPlan>('/api/meal-plans', plan);
      return saved?.id ?? 0;
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        // UNIQUE(user, date, meal_type) conflict (migration 0001).
        console.warn('Slot already occupied; use updateMealPlan instead');
      }
      return 0;
    }
  }

  async updateMealPlan(plan: MealPlan): Promise<boolean> {
    if (!plan.id) return false;
    try {
      await this.api.patch(`/api/meal-plans/${plan.id}`, plan);
      return true;
    } catch {
      return false;
    }
  }

  async deleteMealPlan(id: number): Promise<boolean> {
    try {
      await this.api.delete(`/api/meal-plans/${id}`);
      return true;
    } catch {
      return false;
    }
  }

  async getSummary(from?: string, to?: string): Promise<MealPlanSummary> {
    const today = new Date();
    const startStr = from ?? new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const endStr = to ?? new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    const plans = await this.getMealPlansInRange(startStr, endStr);
    const counts: { breakfast: number; lunch: number; dinner: number } = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
    };
    const nameCounts = new Map<string, number>();
    const favorites: MealPlan[] = [];
    for (const p of plans) {
      counts[p.mealType] = (counts[p.mealType] ?? 0) + 1;
      nameCounts.set(p.mealName, (nameCounts.get(p.mealName) ?? 0) + 1);
      if (p.isFavorite) favorites.push(p);
    }
    const days = Math.max(
      1,
      Math.floor((new Date(endStr).getTime() - new Date(startStr).getTime()) / 86400000) + 1,
    );
    const totalSlots = days * 3;
    const mostFrequentMeals = Array.from(nameCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, mealName: name, count }));
    const monthlyKey = new Map<string, number>();
    for (const p of plans) {
      const k = (p.planDate ?? '').slice(0, 7);
      monthlyKey.set(k, (monthlyKey.get(k) ?? 0) + 1);
    }
    const monthlyBreakdown = Array.from(monthlyKey.entries()).map(([month, count]) => ({
      month,
      count,
      percentage: plans.length ? (count / plans.length) * 100 : 0,
    }));
    return {
      totalSlots,
      filledSlots: plans.length,
      byMealType: counts,
      totalMeals: plans.length,
      breakdownByType: counts,
      mostFrequentMeals,
      favoriteMeals: favorites,
      daysWithPlans: new Set(plans.map((p) => p.planDate)).size,
      averageMealsPerDay: plans.length / days,
      emptySlots: Math.max(0, totalSlots - plans.length),
      completionRate: totalSlots ? plans.length / totalSlots : 0,
      thisWeekCount: this.thisWeekCount(plans),
      currentStreak: this.currentStreak(plans),
      recentMeals: [...plans].sort((a, b) => (a.planDate < b.planDate ? 1 : -1)).slice(0, 10),
      monthlyBreakdown,
    };
  }

  private thisWeekCount(plans: MealPlan[]): number {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const ws = weekStart.toISOString().slice(0, 10);
    const we = weekEnd.toISOString().slice(0, 10);
    return plans.filter((p) => p.planDate >= ws && p.planDate <= we).length;
  }

  private currentStreak(plans: MealPlan[]): number {
    const dates = new Set(plans.map((p) => p.planDate));
    let streak = 0;
    const d = new Date();
    while (dates.has(d.toISOString().slice(0, 10))) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  // Return the recipe library shaped as MealOption[] (label + recipeId) so
  // the meal-plan dialog autocompletes can use it directly.
  async getRecipeNames(): Promise<Array<{ label: string; recipeId: number | null }>> {
    try {
      const recipes = await this.api.get<Array<{ id?: number; name: string }>>('/api/recipes');
      return (recipes ?? []).map((r) => ({ label: r.name, recipeId: r.id ?? null }));
    } catch {
      return [];
    }
  }

  async getMealsByWeek(weekStart: string): Promise<MealPlan[]> {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return this.getMealPlansInRange(weekStart, end.toISOString().slice(0, 10));
  }

  async getMealsByMonth(year: number, month: number): Promise<MealPlan[]> {
    const startDate = new Date(year, month, 1);
    const startStr = startDate.toISOString().slice(0, 10);
    const end = new Date(year, month + 1, 0);
    return this.getMealPlansInRange(startStr, end.toISOString().slice(0, 10));
  }

  async toggleFavorite(plan: MealPlan): Promise<boolean> {
    if (!plan.id) return false;
    return this.updateMealPlan({ ...plan, isFavorite: !plan.isFavorite });
  }
}

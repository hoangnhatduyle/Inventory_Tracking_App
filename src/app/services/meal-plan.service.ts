import { inject, Injectable } from '@angular/core';
import { ApiClient, ApiClientError } from '../core/api-client.service';
import { MealPlan, MealPlanSummary, MealType } from '../models/meal-plan.model';
import { parseLocalDate, toLocalDateString, todayLocalDateString } from '../utils/date.utils';

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
    const todayStr = todayLocalDateString();
    let plans: MealPlan[];
    let rangeStart: string;
    let rangeEnd: string;

    if (from && to) {
      rangeStart = from;
      rangeEnd = to;
      plans = await this.getMealPlansInRange(from, to);
    } else {
      plans = await this.api.get<MealPlan[]>('/api/meal-plans');
      const planDates = plans.map((p) => p.planDate).filter(Boolean);
      rangeStart = planDates.length
        ? planDates.reduce((min, d) => (d < min ? d : min))
        : todayStr;
      rangeEnd = todayStr;
    }

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
      Math.floor(
        (parseLocalDate(rangeEnd).getTime() - parseLocalDate(rangeStart).getTime()) / 86400000,
      ) + 1,
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
    const monthlyBreakdown = Array.from(monthlyKey.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({
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

  private getWeekStartMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private thisWeekCount(plans: MealPlan[]): number {
    const weekStart = this.getWeekStartMonday(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const ws = toLocalDateString(weekStart);
    const we = toLocalDateString(weekEnd);
    return plans.filter((p) => p.planDate >= ws && p.planDate <= we).length;
  }

  private currentStreak(plans: MealPlan[]): number {
    const dates = new Set(plans.map((p) => p.planDate));
    let streak = 0;
    const d = parseLocalDate(todayLocalDateString());

    // If nothing logged today yet, count backward from yesterday.
    if (!dates.has(toLocalDateString(d))) {
      d.setDate(d.getDate() - 1);
    }

    while (dates.has(toLocalDateString(d))) {
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
    const start = parseLocalDate(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return this.getMealPlansInRange(weekStart, toLocalDateString(end));
  }

  async getMealsByMonth(year: number, month: number): Promise<MealPlan[]> {
    const startStr = toLocalDateString(new Date(year, month, 1));
    const endStr = toLocalDateString(new Date(year, month + 1, 0));
    return this.getMealPlansInRange(startStr, endStr);
  }

  async toggleFavorite(plan: MealPlan): Promise<boolean> {
    if (!plan.id) return false;
    return this.updateMealPlan({ ...plan, isFavorite: !plan.isFavorite });
  }
}

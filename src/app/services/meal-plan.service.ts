import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { MealPlan, MealOption, MealPlanSummary } from '../models/meal-plan.model';
import { toLocalDateString } from '../utils/date.utils';

@Injectable({
  providedIn: 'root'
})
export class MealPlanService {
  constructor(private db: DatabaseService) {}

  async getMealsByWeek(userId: number, weekStart: string, weekEnd: string): Promise<MealPlan[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM meal_plans WHERE user_id = ? AND plan_date >= ? AND plan_date <= ? ORDER BY plan_date ASC, meal_type ASC`,
        [userId, weekStart, weekEnd]
      );
      return this.mapRows(result.values || []);
    } catch (error) {
      console.error('Error getting weekly meals:', error);
      return [];
    }
  }

  async getMealsByMonth(userId: number, year: number, month: number): Promise<MealPlan[]> {
    try {
      const firstDay = toLocalDateString(new Date(year, month, 1));
      const lastDay = toLocalDateString(new Date(year, month + 1, 0));
      const result = await this.db.query(
        `SELECT * FROM meal_plans WHERE user_id = ? AND plan_date >= ? AND plan_date <= ? ORDER BY plan_date ASC`,
        [userId, firstDay, lastDay]
      );
      return this.mapRows(result.values || []);
    } catch (error) {
      console.error('Error getting monthly meals:', error);
      return [];
    }
  }

  async addMealPlan(entry: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    try {
      const result = await this.db.run(
        `INSERT INTO meal_plans (user_id, plan_date, meal_type, meal_name, recipe_id, is_favorite, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.userId,
          entry.planDate,
          entry.mealType,
          entry.mealName,
          entry.recipeId ?? null,
          entry.isFavorite ? 1 : 0,
          entry.notes ?? null
        ]
      );
      return result.changes?.lastId ?? 0;
    } catch (error) {
      console.error('Error adding meal plan:', error);
      return 0;
    }
  }

  async updateMealPlan(entry: MealPlan): Promise<boolean> {
    try {
      await this.db.run(
        `UPDATE meal_plans SET meal_name = ?, recipe_id = ?, is_favorite = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        [
          entry.mealName,
          entry.recipeId ?? null,
          entry.isFavorite ? 1 : 0,
          entry.notes ?? null,
          entry.id,
          entry.userId
        ]
      );
      return true;
    } catch (error) {
      console.error('Error updating meal plan:', error);
      return false;
    }
  }

  async deleteMealPlan(id: number): Promise<boolean> {
    try {
      await this.db.run(`DELETE FROM meal_plans WHERE id = ?`, [id]);
      return true;
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      return false;
    }
  }

  async toggleFavorite(id: number, userId: number, currentValue: boolean): Promise<boolean> {
    try {
      await this.db.run(
        `UPDATE meal_plans SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        [currentValue ? 0 : 1, id, userId]
      );
      return true;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return false;
    }
  }

  async getSummary(userId: number): Promise<MealPlanSummary> {
    try {
      const result = await this.db.query(
        `SELECT * FROM meal_plans WHERE user_id = ?`,
        [userId]
      );
      const rows = this.mapRows(result.values || []);

      const breakdown = { breakfast: 0, lunch: 0, dinner: 0 };
      const countMap = new Map<string, number>();

      for (const row of rows) {
        breakdown[row.mealType]++;
        countMap.set(row.mealName, (countMap.get(row.mealName) ?? 0) + 1);
      }

      const mostFrequentMeals = Array.from(countMap.entries())
        .map(([mealName, count]) => ({ mealName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const favoriteMeals = rows
        .filter(r => r.isFavorite)
        .sort((a, b) => b.planDate.localeCompare(a.planDate))
        .slice(0, 20);

      // This week count (Mon–Sun)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const weekStart = toLocalDateString(monday);
      const weekEnd = toLocalDateString(sunday);
      const thisWeekCount = rows.filter(r => r.planDate >= weekStart && r.planDate <= weekEnd).length;

      // Streak — consecutive days backwards from today (or yesterday)
      const uniqueDateSet = new Set(rows.map(r => r.planDate));
      let currentStreak = 0;
      const checkDay = new Date(today);
      // If today has no meal, try from yesterday
      if (!uniqueDateSet.has(toLocalDateString(checkDay))) {
        checkDay.setDate(checkDay.getDate() - 1);
      }
      while (uniqueDateSet.has(toLocalDateString(checkDay))) {
        currentStreak++;
        checkDay.setDate(checkDay.getDate() - 1);
      }

      // Recent meals — last 5 by date
      const recentMeals = [...rows]
        .sort((a, b) => b.planDate.localeCompare(a.planDate) || b.mealType.localeCompare(a.mealType))
        .slice(0, 5);

      // Monthly breakdown — last 6 months
      const monthMap = new Map<string, number>();
      for (const row of rows) {
        const key = row.planDate.substring(0, 7); // YYYY-MM
        monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
      }
      const sortedMonths = Array.from(monthMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 6);
      const maxMonthCount = Math.max(...sortedMonths.map(([, c]) => c), 1);
      const monthlyBreakdown = sortedMonths.map(([key, count]) => {
        const [year, month] = key.split('-');
        const label = new Date(Number(year), Number(month) - 1, 1)
          .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return { month: label, count, percentage: Math.round((count / maxMonthCount) * 100) };
      });

      return {
        totalMeals: rows.length,
        breakdownByType: breakdown,
        mostFrequentMeals,
        favoriteMeals,
        thisWeekCount,
        currentStreak,
        recentMeals,
        monthlyBreakdown
      };
    } catch (error) {
      console.error('Error getting meal plan summary:', error);
      return {
        totalMeals: 0,
        breakdownByType: { breakfast: 0, lunch: 0, dinner: 0 },
        mostFrequentMeals: [],
        favoriteMeals: [],
        thisWeekCount: 0,
        currentStreak: 0,
        recentMeals: [],
        monthlyBreakdown: []
      };
    }
  }

  async getRecipeNames(): Promise<MealOption[]> {
    try {
      const result = await this.db.query(`SELECT id, name FROM recipes ORDER BY name ASC`, []);
      return (result.values || []).map((row: any) => ({
        label: row.name,
        recipeId: row.id
      }));
    } catch (error) {
      console.error('Error getting recipe names:', error);
      return [];
    }
  }

  private mapRows(rows: any[]): MealPlan[] {
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      planDate: row.plan_date,
      mealType: row.meal_type,
      mealName: row.meal_name,
      recipeId: row.recipe_id ?? null,
      isFavorite: row.is_favorite === 1,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

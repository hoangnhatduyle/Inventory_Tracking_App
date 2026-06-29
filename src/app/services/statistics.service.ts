import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../core/api-client.service';
import { InventoryItem } from '../models/inventory.model';
import {
  CategoryStats,
  DashboardStatistics,
  LocationStats,
  Recipe,
  WastedItemStats,
} from '../models/statistics.model';

export type { DashboardStatistics, Recipe };

// Raw payload returned by the `dashboard_summary` Postgres function (see
// supabase/migrations/0005_dashboard_function.sql). Fields are optional only
// because Postgres may legitimately omit empty arrays / nulls.
interface DashboardRaw {
  totalItems?: number;
  totalValue?: number | string;
  expiringCount?: number;
  expiredCount?: number;
  expiringSoon?: InventoryItem[];
  lowStock?: InventoryItem[];
  byCategory?: Array<{ category: string; count: number }>;
  byLocation?: Array<{ location: string; count: number }>;
  waste30dCount?: number;
  waste30dValue?: number | string;
  mostWastedItems?: WastedItemStats[];
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly api = inject(ApiClient);

  async getDashboardStatistics(): Promise<DashboardStatistics> {
    const raw = (await this.api.get<DashboardRaw>('/api/statistics/dashboard')) ?? {};
    const totalValue = Number(raw.totalValue ?? 0) || 0;
    const waste30dValue = Number(raw.waste30dValue ?? 0) || 0;
    const categoryBreakdown: CategoryStats[] = (raw.byCategory ?? []).map((c) => ({
      categoryName: c.category ?? '',
      count: c.count ?? 0,
      totalValue: 0,
    }));
    const locationBreakdown: LocationStats[] = (raw.byLocation ?? []).map((l) => ({
      locationName: l.location ?? '',
      count: l.count ?? 0,
    }));
    return {
      totalItems: raw.totalItems ?? 0,
      totalValue,
      expiringCount: raw.expiringCount ?? 0,
      expiringSoon: raw.expiringSoon ?? [],
      expiredCount: raw.expiredCount ?? 0,
      lowStock: raw.lowStock ?? [],
      categoryBreakdown,
      locationBreakdown,
      wastedItems: raw.mostWastedItems ?? [],
      totalWastedValue: waste30dValue,
      totalSpentValue: totalValue,
      waste30dCount: raw.waste30dCount ?? 0,
      waste30dValue,
    };
  }

  // Recipe suggestions: the old algorithmic version is dropped from v1; this
  // returns an empty array so existing templates render gracefully.
  async getRecipeSuggestions(): Promise<Recipe[]> {
    return [];
  }

  // ---- Recipe library (delegates to /api/recipes; kept on StatisticsService
  //      for backwards compatibility with the recipe-manager component) ----

  async getAllRecipes(): Promise<Recipe[]> {
    try {
      return await this.api.get<Recipe[]>('/api/recipes');
    } catch {
      return [];
    }
  }

  async addRecipe(recipe: Recipe): Promise<boolean> {
    try {
      await this.api.post('/api/recipes', recipe);
      return true;
    } catch {
      return false;
    }
  }

  async updateRecipe(recipe: Recipe): Promise<boolean> {
    if (!recipe.id) return false;
    try {
      await this.api.patch(`/api/recipes/${recipe.id}`, recipe);
      return true;
    } catch {
      return false;
    }
  }

  async deleteRecipe(id: number): Promise<boolean> {
    try {
      await this.api.delete(`/api/recipes/${id}`);
      return true;
    } catch {
      return false;
    }
  }

  // CSV export of the current inventory list. The new web build calls the
  // dedicated `buildInventoryCsv(items)` helper instead; this remains as a
  // shim so older callers keep working.
  async exportInventoryData(items: InventoryItem[]): Promise<string> {
    return this.buildInventoryCsv(items);
  }

  // CSV export of the current inventory. Kept client-side because the
  // browser can directly trigger the download. Server-side export would
  // require sending the file back to the browser anyway.
  buildInventoryCsv(items: InventoryItem[]): string {
    const header = ['Name', 'Category', 'Quantity', 'Unit', 'Expiration', 'Notes'];
    const escape = (v: unknown): string => {
      const s = v == null ? '' : String(v);
      // Defuse formula injection (=, +, -, @) by prefixing with a single quote.
      const sanitised = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return `"${sanitised.replace(/"/g, '""')}"`;
    };
    const rows = items.map((i) =>
      [i.name, i.categoryId, i.quantity, i.unit, i.expirationDate, i.notes].map(escape).join(','),
    );
    return [header.join(','), ...rows].join('\r\n');
  }
}
